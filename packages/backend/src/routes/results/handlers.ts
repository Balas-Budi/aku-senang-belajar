import { asc, eq, inArray } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { evidenceOf, missionCompetencyIds } from '../../analysis/evidence.ts';
import { queueAnalysis } from '../../analysis/runner.ts';
import { currentUser } from '../../auth/guards.ts';
import {
    assessments,
    classes,
    competencies,
    verifications,
} from '../../db/schema.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { membersOf, ownedClassId } from '../classes/queries.ts';
import type { ClassParams } from '../classes/schema.ts';
import {
    attemptsOf,
    classAssignments,
    currentRuns,
    decisionsOn,
    lockedAttempt,
    ownedAssessment,
    ownedAssignment,
    shownOf,
} from './queries.ts';
import {
    type AssessmentParams,
    type AssignmentParams,
    type AttemptParams,
    type Overview,
    type StudentParams,
    storedAssessment,
    type VerificationBody,
} from './schema.ts';

type Status = typeof assessments.$inferSelect.status;

function decidedStatus(body: VerificationBody, estimate: Status): Status {
    if (body.decision === 'change') {
        return body.status;
    }

    return body.decision === 'agree' ? estimate : 'needs_verification';
}

export async function listAssignments(
    request: FastifyRequest<{ Params: ClassParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );
    const assigned = await classAssignments(db, classId);
    const members = await membersOf(db, classId);
    const taken = await attemptsOf(
        db,
        assigned.map(({ id }) => id),
        members.map(({ id }) => id),
    );
    const runs = await currentRuns(
        db,
        taken.map(({ id }) => id),
    );

    return assigned.map((assignment) => {
        const submitted = taken.filter(
            ({ assignmentId, status }) =>
                assignmentId === assignment.id && status === 'submitted',
        );

        return {
            ...assignment,
            studentCount: members.length,
            submittedCount: submitted.length,
            analysedCount: submitted.filter(
                ({ id }) => runs.get(id)?.status === 'succeeded',
            ).length,
        };
    });
}

export async function sessionResults(
    request: FastifyRequest<{ Params: AssignmentParams }>,
) {
    const { db } = request.server;
    const assignment = await ownedAssignment(
        db,
        currentUser(request).id,
        request.params,
    );
    const missionCompetencies = await db
        .select({
            id: competencies.id,
            code: competencies.code,
            description: competencies.description,
        })
        .from(competencies)
        .where(
            inArray(competencies.id, missionCompetencyIds(db, assignment.id)),
        )
        .orderBy(asc(competencies.code));
    const members = await membersOf(db, assignment.classId);
    const taken = await attemptsOf(
        db,
        [assignment.id],
        members.map(({ id }) => id),
    );
    const runs = await currentRuns(
        db,
        taken.map(({ id }) => id),
    );
    const finished = [...runs.values()]
        .filter(({ status }) => status === 'succeeded')
        .map(({ id }) => id);
    const estimates =
        finished.length === 0
            ? []
            : await db
                  .select({
                      id: assessments.id,
                      runId: assessments.runId,
                      competencyId: assessments.competencyId,
                      status: assessments.status,
                  })
                  .from(assessments)
                  .where(inArray(assessments.runId, finished));
    const decisions = await decisionsOn(
        db,
        estimates.map(({ id }) => id),
    );

    return {
        assignment,
        competencies: missionCompetencies,
        students: members.map((member) => {
            const attempt = taken.find(
                ({ studentId }) => studentId === member.id,
            );
            const run = attempt ? runs.get(attempt.id) : undefined;
            const cells =
                run?.status === 'succeeded'
                    ? missionCompetencies.flatMap((competency) =>
                          estimates
                              .filter(
                                  ({ runId, competencyId }) =>
                                      runId === run.id &&
                                      competencyId === competency.id,
                              )
                              .map((estimate) => ({
                                  competencyId: competency.id,
                                  assessmentId: estimate.id,
                                  ...shownOf(
                                      estimate.status,
                                      decisions.filter(
                                          ({ assessmentId }) =>
                                              assessmentId === estimate.id,
                                      ),
                                  ),
                              })),
                      )
                    : [];

            return {
                id: member.id,
                name: member.name,
                progress: attempt?.status ?? ('not_started' as const),
                attemptId: attempt?.id ?? null,
                analysis: run?.status ?? null,
                competencies: cells,
            };
        }),
    };
}

export async function studentEvidence(
    request: FastifyRequest<{ Params: StudentParams }>,
) {
    const { db } = request.server;
    const assignment = await ownedAssignment(
        db,
        currentUser(request).id,
        request.params,
    );
    const student = (await membersOf(db, assignment.classId)).find(
        ({ id }) => id === request.params.studentId,
    );

    if (!student) {
        throw notFound('Student not found');
    }

    const header = {
        student: { id: student.id, name: student.name },
        assignment,
    };
    const [attempt] = await attemptsOf(db, [assignment.id], [student.id]);

    if (!attempt) {
        return {
            ...header,
            progress: 'not_started' as const,
            attemptId: null,
            analysis: null,
            competencies: [],
        };
    }

    const run = (await currentRuns(db, [attempt.id])).get(attempt.id);
    const estimates =
        run?.status === 'succeeded'
            ? await db
                  .select()
                  .from(assessments)
                  .where(eq(assessments.runId, run.id))
            : [];
    const decisions = await decisionsOn(
        db,
        estimates.map(({ id }) => id),
    );
    const evidence = await evidenceOf(db, attempt.id);

    return {
        ...header,
        progress: attempt.status,
        attemptId: attempt.id,
        analysis: run?.status ?? null,
        competencies: evidence.map((competency) => {
            const estimate = estimates.find(
                ({ competencyId }) => competencyId === competency.id,
            );

            if (!estimate) {
                return { ...competency, assessment: null };
            }

            const history = decisions.filter(
                ({ assessmentId }) => assessmentId === estimate.id,
            );

            return {
                ...competency,
                assessment: {
                    ...storedAssessment.parse(estimate),
                    id: estimate.id,
                    status: estimate.status,
                    reason: estimate.reason,
                    uncertainty: estimate.uncertainty,
                    shown: shownOf(estimate.status, history),
                    verifications: history,
                },
            };
        }),
    };
}

export async function verify(
    request: FastifyRequest<{
        Params: AssessmentParams;
        Body: VerificationBody;
    }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const teacher = currentUser(request);
    const estimate = await ownedAssessment(
        db,
        teacher.id,
        request.params.assessmentId,
    );
    const { body } = request;

    if (body.decision === 'change' && body.status === estimate.status) {
        throw fieldError(
            'status',
            'A change needs a status other than the estimate',
        );
    }

    const [verification] = await db
        .insert(verifications)
        .values({
            assessmentId: estimate.id,
            teacherId: teacher.id,
            decision: body.decision,
            status: decidedStatus(body, estimate.status),
            note: body.note || null,
        })
        .returning({
            id: verifications.id,
            decision: verifications.decision,
            status: verifications.status,
            note: verifications.note,
            createdAt: verifications.createdAt,
        });

    return reply.code(201).send(verification);
}

export async function analyseAgain(
    request: FastifyRequest<{ Params: AttemptParams }>,
    reply: FastifyReply,
) {
    const teacherId = currentUser(request).id;

    await request.server.db.transaction(async (tx) => {
        const attempt = await lockedAttempt(
            tx,
            teacherId,
            request.params.attemptId,
        );
        const run = (await currentRuns(tx, [attempt.id])).get(attempt.id);

        if (
            attempt.status !== 'submitted' ||
            (run && run.status !== 'failed')
        ) {
            throw new AppError(409, {
                message:
                    'Only a submitted attempt whose analysis failed or never ran can be analysed again',
                code: 'ANALYSIS_NOT_RETRYABLE',
            });
        }

        await queueAnalysis(tx, attempt.id);
    });

    return reply.code(202).send({ analysis: 'queued' as const });
}

export async function teacherOverview(request: FastifyRequest) {
    const { db } = request.server;
    const owned = await db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(eq(classes.teacherId, currentUser(request).id))
        .orderBy(asc(classes.name), asc(classes.id));
    const missions: Overview['missions'] = [];
    const checks: Overview['checks'] = [];

    for (const classroom of owned) {
        const assigned = await classAssignments(db, classroom.id);
        const members = await membersOf(db, classroom.id);
        const names = new Map(members.map(({ id, name }) => [id, name]));
        const taken = await attemptsOf(
            db,
            assigned.map(({ id }) => id),
            members.map(({ id }) => id),
        );
        const runs = await currentRuns(
            db,
            taken.map(({ id }) => id),
        );
        const finished = [...runs.values()]
            .filter(({ status }) => status === 'succeeded')
            .map(({ id }) => id);
        const estimates =
            finished.length === 0
                ? []
                : await db
                      .select({
                          id: assessments.id,
                          runId: assessments.runId,
                          status: assessments.status,
                          code: competencies.code,
                      })
                      .from(assessments)
                      .innerJoin(
                          competencies,
                          eq(competencies.id, assessments.competencyId),
                      )
                      .where(inArray(assessments.runId, finished))
                      .orderBy(asc(competencies.code));
        const decisions = await decisionsOn(
            db,
            estimates.map(({ id }) => id),
        );

        for (const assignment of assigned) {
            const submitted = taken.filter(
                ({ assignmentId, status }) =>
                    assignmentId === assignment.id && status === 'submitted',
            );
            let needsVerification = 0;
            let unreviewed = 0;
            let waiting = 0;

            for (const attempt of submitted) {
                const run = runs.get(attempt.id);

                if (!run || run.status === 'failed') {
                    waiting += 1;
                    continue;
                }

                for (const estimate of estimates) {
                    if (estimate.runId !== run.id) continue;

                    const shown = shownOf(
                        estimate.status,
                        decisions.filter(
                            ({ assessmentId }) => assessmentId === estimate.id,
                        ),
                    );

                    if (shown.status === 'needs_verification') {
                        needsVerification += 1;
                        checks.push({
                            classId: classroom.id,
                            className: classroom.name,
                            assignmentId: assignment.id,
                            missionTitle: assignment.title,
                            studentId: attempt.studentId,
                            studentName: names.get(attempt.studentId) ?? '',
                            competencyCode: estimate.code,
                            decision: shown.decision,
                        });
                    } else if (shown.decision === null) {
                        unreviewed += 1;
                    }
                }
            }

            if (submitted.length > 0) {
                missions.push({
                    classId: classroom.id,
                    className: classroom.name,
                    assignmentId: assignment.id,
                    title: assignment.title,
                    students: members.length,
                    submitted: submitted.length,
                    needsVerification,
                    unreviewed,
                    waiting,
                });
            }
        }
    }

    const total = (field: 'needsVerification' | 'unreviewed' | 'waiting') =>
        missions.reduce((sum, mission) => sum + mission[field], 0);

    return {
        needsVerification: total('needsVerification'),
        unreviewed: total('unreviewed'),
        waiting: total('waiting'),
        missions,
        checks,
    };
}

import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../../db/index.ts';
import {
    analysisRuns,
    assignments,
    assessments,
    attempts,
    classes,
    competencies,
    learnerAdaptations,
    learnerSummaries,
    learningSessions,
    reports,
    reviewTries,
    sessionBlocks,
    studentSettings,
    subject,
} from '../../db/schema.ts';
import { followedPair } from '../../learning/adaptation.ts';
import { sessionBlock } from '../../learning/blocks.ts';
import { themedOr, themesFor } from '../../learning/themed-blocks.ts';
import { notFound } from '../../lib/errors.ts';
import {
    keptSummaries,
    MAX_ADAPTATION_TRIES,
} from '../../memory/adaptations.ts';
import { membersOf } from '../classes/queries.ts';
import {
    attemptsOf,
    classAssignments,
    currentRuns,
    decisionsOn,
    reachableAttempts,
    shownOf,
} from '../results/queries.ts';

type Status = typeof assessments.$inferSelect.status;
type Subject = (typeof subject.enumValues)[number];
type Round = {
    tries: number;
    result: 'correct' | 'revealed' | 'open';
    at: Date;
};

export type Scope = {
    classId: number;
    moduleId: number | null;
    studentId: number | null;
};

async function judged(db: Queryable, attemptIds: number[]) {
    const runs = await currentRuns(db, attemptIds);
    const finished = [...runs.values()]
        .filter(({ status }) => status === 'succeeded')
        .map(({ id }) => id);

    if (finished.length === 0) {
        return { runs, estimates: [], decisions: [], summaries: [] };
    }

    const estimates = await db
        .select({
            id: assessments.id,
            competencyId: assessments.competencyId,
            status: assessments.status,
            attemptId: analysisRuns.attemptId,
        })
        .from(assessments)
        .innerJoin(analysisRuns, eq(analysisRuns.id, assessments.runId))
        .where(inArray(assessments.runId, finished));
    const decisions = await decisionsOn(
        db,
        estimates.map(({ id }) => id),
    );
    const summaries = await db
        .select({
            id: learnerSummaries.id,
            runId: learnerSummaries.runId,
            text: learnerSummaries.text,
            excludedAt: learnerSummaries.excludedAt,
        })
        .from(learnerSummaries)
        .where(
            and(
                inArray(learnerSummaries.runId, finished),
                isNotNull(learnerSummaries.text),
            ),
        )
        .orderBy(asc(learnerSummaries.id));

    return { runs, estimates, decisions, summaries };
}

function shownFor(
    estimate: { id: number; status: Status },
    decisions: Awaited<ReturnType<typeof decisionsOn>>,
) {
    return shownOf(
        estimate.status,
        decisions.filter(({ assessmentId }) => assessmentId === estimate.id),
    );
}

function usable(
    summaries: { id: number; text: string | null; excludedAt: Date | null }[],
) {
    return summaries.flatMap(({ id, text, excludedAt }) =>
        text !== null && excludedAt === null ? [{ id, text }] : [],
    );
}

export async function chapterMap(
    db: Queryable,
    classId: number,
    moduleId: number,
) {
    const missions = (await classAssignments(db, classId))
        .filter((assignment) => assignment.moduleId === moduleId)
        .sort((first, second) => first.id - second.id);
    const [first] = missions;

    if (!first) {
        throw notFound('Chapter not found');
    }

    const chapterCompetencies = await db
        .select({
            id: competencies.id,
            code: competencies.code,
            description: competencies.description,
        })
        .from(competencies)
        .where(eq(competencies.moduleId, moduleId))
        .orderBy(asc(competencies.code));
    const members = await membersOf(db, classId);
    const taken = await attemptsOf(
        db,
        missions.map(({ id }) => id),
        members.map(({ id }) => id),
    );
    const { runs, estimates, decisions, summaries } = await judged(
        db,
        taken.map(({ id }) => id),
    );
    const submittedAt = (attemptId: number) =>
        taken.find(({ id }) => id === attemptId)?.submittedAt?.getTime() ?? 0;
    const students = members.map((member) => {
        const mine = taken.filter(({ studentId }) => studentId === member.id);

        return {
            id: member.id,
            name: member.name,
            finished: mine.filter(({ status }) => status === 'submitted')
                .length,
            competencies: chapterCompetencies.flatMap((competency) => {
                const [newest] = estimates
                    .filter(
                        ({ competencyId, attemptId }) =>
                            competencyId === competency.id &&
                            mine.some(({ id }) => id === attemptId),
                    )
                    .sort(
                        (one, other) =>
                            submittedAt(other.attemptId) -
                                submittedAt(one.attemptId) || other.id - one.id,
                    );
                const attempt = mine.find(({ id }) => id === newest?.attemptId);

                return newest && attempt
                    ? [
                          {
                              competencyId: competency.id,
                              assessmentId: newest.id,
                              assignmentId: attempt.assignmentId,
                              ...shownFor(newest, decisions),
                          },
                      ]
                    : [];
            }),
        };
    });
    const counts = chapterCompetencies.map((competency) => {
        const cells = students.flatMap(({ competencies: entries }) =>
            entries.filter(
                ({ competencyId }) => competencyId === competency.id,
            ),
        );
        const at = (status: Status) =>
            cells.filter((cell) => cell.status === status).length;

        return {
            competencyId: competency.id,
            visible: at('visible'),
            developing: at('developing'),
            needsVerification: at('needs_verification'),
            notObserved: at('not_observed'),
            withEvidence: cells.length - at('not_observed'),
        };
    });

    return {
        chapter: {
            id: moduleId,
            title: first.moduleTitle,
            subject: first.subject,
        },
        missions: missions.map((mission) => {
            const submitted = taken.filter(
                ({ assignmentId, status }) =>
                    assignmentId === mission.id && status === 'submitted',
            );

            return {
                id: mission.id,
                title: mission.title,
                submittedCount: submitted.length,
                analysedCount: submitted.filter(
                    ({ id }) => runs.get(id)?.status === 'succeeded',
                ).length,
            };
        }),
        competencies: chapterCompetencies,
        studentCount: members.length,
        students,
        counts,
        summaries: usable(summaries),
    };
}

export async function studentHistory(
    db: Queryable,
    classId: number,
    student: { id: number; name: string },
) {
    const studentId = student.id;
    const assigned = await classAssignments(db, classId);
    const taken = (
        await attemptsOf(
            db,
            assigned.map(({ id }) => id),
            [studentId],
        )
    )
        .filter(({ status }) => status === 'submitted')
        .sort(
            (one, other) =>
                (one.submittedAt?.getTime() ?? 0) -
                    (other.submittedAt?.getTime() ?? 0) || one.id - other.id,
        );
    const { runs, estimates, decisions, summaries } = await judged(
        db,
        taken.map(({ id }) => id),
    );
    const named =
        estimates.length === 0
            ? []
            : await db
                  .select({
                      id: competencies.id,
                      code: competencies.code,
                      description: competencies.description,
                  })
                  .from(competencies)
                  .where(
                      inArray(
                          competencies.id,
                          estimates.map(({ competencyId }) => competencyId),
                      ),
                  );

    return {
        student: { id: student.id, name: student.name },
        missions: taken.flatMap((attempt) => {
            const assignment = assigned.find(
                ({ id }) => id === attempt.assignmentId,
            );
            const run = runs.get(attempt.id);
            const summary = summaries.find(({ runId }) => runId === run?.id);

            return assignment
                ? [
                      {
                          assignmentId: assignment.id,
                          title: assignment.title,
                          chapter: assignment.moduleTitle,
                          submittedAt: attempt.submittedAt,
                          analysis: run?.status ?? null,
                          summary: summary
                              ? {
                                    id: summary.id,
                                    text: summary.text ?? '',
                                    excluded: summary.excludedAt !== null,
                                }
                              : null,
                          memoryDeleted: attempt.memoryDeletedAt !== null,
                          competencies: estimates
                              .filter(
                                  ({ attemptId }) => attemptId === attempt.id,
                              )
                              .flatMap((estimate) => {
                                  const competency = named.find(
                                      ({ id }) => id === estimate.competencyId,
                                  );

                                  return competency
                                      ? [
                                            {
                                                ...competency,
                                                assessmentId: estimate.id,
                                                estimate: estimate.status,
                                                shown: shownFor(
                                                    estimate,
                                                    decisions,
                                                ),
                                                verifications: decisions.filter(
                                                    ({ assessmentId }) =>
                                                        assessmentId ===
                                                        estimate.id,
                                                ),
                                            },
                                        ]
                                      : [];
                              })
                              .sort((one, other) =>
                                  one.code.localeCompare(other.code),
                              ),
                      },
                  ]
                : [];
        }),
        summaries: usable(summaries),
    };
}

const readIds = z.array(z.int());

export async function reportIn(
    db: Queryable,
    scope: Scope,
    summaryIds: number[],
) {
    const [report] = await db
        .select({
            id: reports.id,
            draft: reports.draft,
            text: reports.text,
            drafting: reports.drafting,
            summaryIds: reports.summaryIds,
            draftedAt: reports.draftedAt,
            checkedAt: reports.checkedAt,
        })
        .from(reports)
        .where(scopeOf(scope));

    if (!report) return null;

    const read = readIds.parse(report.summaryIds);

    return {
        id: report.id,
        draft: report.draft,
        text: report.text,
        drafting: report.drafting,
        draftedAt: report.draftedAt,
        checkedAt: report.checkedAt,
        outdated:
            report.draftedAt !== null &&
            (read.length !== summaryIds.length ||
                read.some((id) => !summaryIds.includes(id))),
    };
}

export function scopeOf(scope: Scope) {
    return and(
        eq(reports.classId, scope.classId),
        scope.moduleId === null
            ? isNull(reports.moduleId)
            : eq(reports.moduleId, scope.moduleId),
        scope.studentId === null
            ? isNull(reports.studentId)
            : eq(reports.studentId, scope.studentId),
    );
}

export async function ownedReport(
    db: Queryable,
    teacherId: number,
    reportId: number,
) {
    const [report] = await db
        .select({
            id: reports.id,
            classId: reports.classId,
            moduleId: reports.moduleId,
            studentId: reports.studentId,
        })
        .from(reports)
        .innerJoin(classes, eq(classes.id, reports.classId))
        .where(and(eq(reports.id, reportId), eq(classes.teacherId, teacherId)));

    if (
        !report ||
        (report.studentId !== null &&
            !(await membersOf(db, report.classId)).some(
                ({ id }) => id === report.studentId,
            ))
    ) {
        throw notFound('Report not found');
    }

    return report;
}

export async function ownedSummary(
    db: Queryable,
    teacherId: number,
    summaryId: number,
) {
    const [summary] = await db
        .select({ id: learnerSummaries.id })
        .from(learnerSummaries)
        .innerJoin(analysisRuns, eq(analysisRuns.id, learnerSummaries.runId))
        .where(
            and(
                eq(learnerSummaries.id, summaryId),
                isNotNull(learnerSummaries.text),
                inArray(
                    analysisRuns.attemptId,
                    reachableAttempts(db, teacherId),
                ),
            ),
        );

    if (!summary) {
        throw notFound('Summary not found');
    }

    return summary;
}

export async function practiceOf(
    db: Queryable,
    classId: number,
    studentId: number,
) {
    const tries = await db
        .select({
            blockId: reviewTries.blockId,
            outcome: reviewTries.outcome,
            help: reviewTries.help,
            at: reviewTries.createdAt,
            kind: sessionBlocks.kind,
            content: sessionBlocks.content,
            mission: learningSessions.title,
            theme: attempts.theme,
        })
        .from(reviewTries)
        .innerJoin(sessionBlocks, eq(sessionBlocks.id, reviewTries.blockId))
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, sessionBlocks.learningSessionId),
        )
        .innerJoin(
            assignments,
            and(
                eq(assignments.learningSessionId, learningSessions.id),
                eq(assignments.classId, classId),
            ),
        )
        .leftJoin(
            attempts,
            and(
                eq(attempts.assignmentId, assignments.id),
                eq(attempts.studentId, reviewTries.studentId),
            ),
        )
        .where(eq(reviewTries.studentId, studentId))
        .orderBy(asc(reviewTries.id));
    const themes = await themesFor(
        db,
        tries.map(({ blockId, theme }) => ({ blockId, theme })),
    );
    const questions = new Map<
        number,
        {
            blockId: number;
            kind: 'review' | 'extra';
            mission: string;
            prompt: string;
            rounds: Round[];
        }
    >();

    for (const item of tries) {
        const block = sessionBlock.safeParse({
            kind: item.kind,
            content: item.content,
        });

        const shown =
            block.success && themedOr(block.data, themes.get(item.blockId));

        if (
            !shown ||
            (shown.kind !== 'check' && shown.kind !== 'extra_challenge')
        ) {
            continue;
        }

        const question = questions.get(item.blockId) ?? {
            blockId: item.blockId,
            kind: shown.kind === 'check' ? 'review' : 'extra',
            mission: item.mission,
            prompt: shown.content.prompt,
            rounds: [],
        };
        const open = question.rounds.at(-1);
        const round: Round =
            open?.result === 'open'
                ? open
                : { tries: 0, result: 'open', at: item.at };

        if (round !== open) question.rounds.push(round);
        round.tries += 1;
        round.at = item.at;
        round.result =
            item.outcome === 'correct'
                ? 'correct'
                : item.help === 'reveal'
                  ? 'revealed'
                  : 'open';
        questions.set(item.blockId, question);
    }

    return [...questions.values()];
}

export async function adaptationsOf(
    db: Queryable,
    classId: number,
    studentId: number,
    only?: Subject,
) {
    const rows = await db
        .select()
        .from(learnerAdaptations)
        .where(
            and(
                eq(learnerAdaptations.studentId, studentId),
                eq(learnerAdaptations.classId, classId),
                only === undefined
                    ? undefined
                    : eq(learnerAdaptations.subject, only),
            ),
        );
    const [settings] = await db
        .select({ readAloudChosen: studentSettings.readAloudChosen })
        .from(studentSettings)
        .where(eq(studentSettings.studentId, studentId));
    const readAloudChosen = settings?.readAloudChosen ?? false;
    const taught =
        only === undefined
            ? (await classAssignments(db, classId)).map(
                  ({ subject: taughtSubject }) => taughtSubject,
              )
            : [only];
    const shown = subject.enumValues.filter(
        (value) =>
            taught.includes(value) || rows.some((row) => row.subject === value),
    );

    return Promise.all(
        shown.map(async (value) => {
            const row = rows.find((entry) => entry.subject === value);
            const thin = (await keptSummaries(db, studentId, value)).length < 2;

            if (!row) {
                return {
                    subject: value,
                    helpFirst: null,
                    lead: null,
                    source: 'ai' as const,
                    off: false,
                    pending: false,
                    failed: false,
                    thin,
                    readAloudChosen,
                    ai: null,
                    teacher: null,
                };
            }

            const followed = followedPair(row);
            const waiting = row.queued > row.handled;

            return {
                subject: value,
                helpFirst: followed?.helpFirst ?? null,
                lead: followed?.lead ?? null,
                source: row.source,
                off: row.off,
                pending: waiting && row.tries < MAX_ADAPTATION_TRIES,
                failed: waiting && row.tries >= MAX_ADAPTATION_TRIES,
                thin,
                readAloudChosen,
                ai: row.suggestedAt
                    ? {
                          helpFirst: row.aiHelpFirst,
                          lead: row.aiLead,
                          reason: row.aiReason,
                          suggestedAt: row.suggestedAt,
                      }
                    : null,
                teacher:
                    row.source === 'teacher' &&
                    row.helpFirst !== null &&
                    row.setAt !== null
                        ? {
                              helpFirst: row.helpFirst,
                              lead: row.lead,
                              setAt: row.setAt,
                          }
                        : null,
            };
        }),
    );
}

import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import {
    analysisRuns,
    assessments,
    assignments,
    attempts,
    classes,
    classMembers,
    learningSessions,
    materials,
    modules,
    users,
    verifications,
} from '../../db/schema.ts';
import { notFound } from '../../lib/errors.ts';
import { ownedClassId } from '../classes/queries.ts';

type Status = typeof assessments.$inferSelect.status;
type Decision = typeof verifications.$inferSelect.decision;

export function classAssignments(
    db: Queryable,
    classId: number,
    assignmentId?: number,
) {
    return db
        .select({
            id: assignments.id,
            title: learningSessions.title,
            subject: materials.subject,
            moduleTitle: modules.title,
            moduleId: modules.id,
            assignedAt: assignments.assignedAt,
        })
        .from(assignments)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(assignments.classId, classId),
                eq(learningSessions.status, 'ready'),
                assignmentId === undefined
                    ? undefined
                    : eq(assignments.id, assignmentId),
            ),
        )
        .orderBy(desc(assignments.assignedAt), asc(assignments.id));
}

export async function ownedAssignment(
    db: Queryable,
    teacherId: number,
    params: { classId: number; assignmentId: number },
) {
    const classId = await ownedClassId(db, params.classId, teacherId);
    const [assignment] = await classAssignments(
        db,
        classId,
        params.assignmentId,
    );

    if (!assignment) {
        throw notFound('Assignment not found');
    }

    return { ...assignment, classId };
}

export async function attemptsOf(
    db: Queryable,
    assignmentIds: number[],
    studentIds: number[],
) {
    if (assignmentIds.length === 0 || studentIds.length === 0) {
        return [];
    }

    return db
        .select({
            id: attempts.id,
            assignmentId: attempts.assignmentId,
            studentId: attempts.studentId,
            status: attempts.status,
            submittedAt: attempts.submittedAt,
            memoryDeletedAt: attempts.memoryDeletedAt,
            theme: attempts.theme,
            adaptation: attempts.adaptation,
        })
        .from(attempts)
        .where(
            and(
                inArray(attempts.assignmentId, assignmentIds),
                inArray(attempts.studentId, studentIds),
            ),
        );
}

export async function currentRuns(db: Queryable, attemptIds: number[]) {
    const runs =
        attemptIds.length === 0
            ? []
            : await db
                  .selectDistinctOn([analysisRuns.attemptId], {
                      id: analysisRuns.id,
                      attemptId: analysisRuns.attemptId,
                      status: analysisRuns.status,
                  })
                  .from(analysisRuns)
                  .where(inArray(analysisRuns.attemptId, attemptIds))
                  .orderBy(analysisRuns.attemptId, desc(analysisRuns.id));

    return new Map(runs.map((run) => [run.attemptId, run]));
}

export async function decisionsOn(db: Queryable, assessmentIds: number[]) {
    if (assessmentIds.length === 0) {
        return [];
    }

    return db
        .select({
            id: verifications.id,
            assessmentId: verifications.assessmentId,
            decision: verifications.decision,
            status: verifications.status,
            note: verifications.note,
            createdAt: verifications.createdAt,
        })
        .from(verifications)
        .where(inArray(verifications.assessmentId, assessmentIds))
        .orderBy(desc(verifications.id));
}

export function shownOf(
    estimate: Status,
    decisions: { status: Status; decision: Decision }[],
) {
    const [latest] = decisions;

    return latest
        ? { status: latest.status, decision: latest.decision }
        : { status: estimate, decision: null };
}

export function reachableAttempts(db: Queryable, teacherId: number) {
    return db
        .select({ id: attempts.id })
        .from(attempts)
        .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .innerJoin(
            classMembers,
            and(
                eq(classMembers.classId, classes.id),
                eq(classMembers.studentId, attempts.studentId),
            ),
        )
        .innerJoin(users, eq(users.id, attempts.studentId))
        .where(and(eq(classes.teacherId, teacherId), isNull(users.deletedAt)));
}

export async function ownedAssessment(
    db: Queryable,
    teacherId: number,
    assessmentId: number,
) {
    const [assessment] = await db
        .select({ id: assessments.id, status: assessments.status })
        .from(assessments)
        .innerJoin(analysisRuns, eq(analysisRuns.id, assessments.runId))
        .where(
            and(
                eq(assessments.id, assessmentId),
                inArray(
                    analysisRuns.attemptId,
                    reachableAttempts(db, teacherId),
                ),
            ),
        );

    if (!assessment) {
        throw notFound('Assessment not found');
    }

    return assessment;
}

export async function lockedAttempt(
    tx: Queryable,
    teacherId: number,
    attemptId: number,
) {
    const [attempt] = await tx
        .select({ id: attempts.id, status: attempts.status })
        .from(attempts)
        .where(
            and(
                eq(attempts.id, attemptId),
                inArray(attempts.id, reachableAttempts(tx, teacherId)),
            ),
        )
        .for('update');

    if (!attempt) {
        throw notFound('Attempt not found');
    }

    return attempt;
}

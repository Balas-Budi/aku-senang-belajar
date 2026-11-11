import { and, desc, eq } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    attempts,
    classMembers,
    learningSessions,
    materials,
    modules,
    type subject,
} from '../../db/schema.ts';

type Subject = (typeof subject.enumValues)[number];

export function missionsOf(
    db: Queryable,
    studentId: number,
    only?: Subject,
    classId?: number,
) {
    return db
        .select({
            attemptId: attempts.id,
            sessionId: learningSessions.id,
            moduleId: modules.id,
            title: learningSessions.title,
            theme: attempts.theme,
            submittedAt: attempts.submittedAt,
            readAloud: attempts.readAloud,
            adaptation: attempts.adaptation,
        })
        .from(attempts)
        .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
        .innerJoin(
            classMembers,
            and(
                eq(classMembers.classId, assignments.classId),
                eq(classMembers.studentId, attempts.studentId),
            ),
        )
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(attempts.studentId, studentId),
                eq(attempts.status, 'submitted'),
                only === undefined ? undefined : eq(materials.subject, only),
                classId === undefined
                    ? undefined
                    : eq(assignments.classId, classId),
            ),
        )
        .orderBy(desc(attempts.submittedAt), desc(attempts.id));
}

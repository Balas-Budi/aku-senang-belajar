import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    attempts,
    classMembers,
    learningSessions,
    materials,
    modules,
    sessionBlocks,
    subject,
} from '../../db/schema.ts';
import { stepOfKind } from '../../learning/blocks.ts';
import { AppError } from '../../lib/errors.ts';

type Subject = (typeof subject.enumValues)[number];

type ChapterRow = { id: number; title: string; book: string; subject: Subject };

type StageRow = {
    id: number;
    assignedAt: Date;
    title: string;
    summary: string;
    moduleId: number;
    status: 'in_progress' | 'submitted' | null;
    checkpointKind: keyof typeof stepOfKind | null;
};

export const stageLocked = () =>
    new AppError(409, {
        message: 'Finish the stage before this one first',
        code: 'STAGE_LOCKED',
    });

// Stage rows arrive in stage order (session id); chapter rows in book order.
function buildPath(chapterRows: ChapterRow[], stageRows: StageRow[]) {
    const chapters = chapterRows.map((chapter) => {
        const rows = stageRows.filter((row) => row.moduleId === chapter.id);
        const stages = rows.map((row, index) => {
            const progress = row.status ?? ('not_started' as const);
            const previous = rows[index - 1];

            return {
                id: row.id,
                title: row.title,
                summary: row.summary,
                progress,
                step:
                    row.status === 'in_progress' && row.checkpointKind
                        ? stepOfKind[row.checkpointKind]
                        : null,
                locked:
                    progress === 'not_started' &&
                    previous !== undefined &&
                    previous.status !== 'submitted',
            };
        });

        return {
            ...chapter,
            open: rows.length > 0,
            openedAt: Math.max(0, ...rows.map((row) => +row.assignedAt)),
            stages,
        };
    });
    const [next] = chapters
        .flatMap((chapter) =>
            chapter.stages
                .filter((stage) => stage.progress !== 'submitted')
                .filter((stage) => !stage.locked)
                .map((stage) => ({ chapter, stage })),
        )
        .sort(
            (a, b) =>
                Number(b.stage.progress === 'in_progress') -
                    Number(a.stage.progress === 'in_progress') ||
                b.chapter.openedAt - a.chapter.openedAt,
        );

    return {
        next: next
            ? {
                  chapterId: next.chapter.id,
                  chapterTitle: next.chapter.title,
                  subject: next.chapter.subject,
                  stage: next.stage,
              }
            : null,
        subjects: subject.enumValues
            .map((name) => ({
                subject: name,
                chapters: chapters
                    .filter((chapter) => chapter.subject === name)
                    .map(({ id, title, book, open, stages }) => ({
                        id,
                        title,
                        book,
                        open,
                        stages,
                    })),
            }))
            .filter(({ chapters: list }) => list.length > 0),
    };
}

export async function pathOf(db: Queryable, studentId: number) {
    const stageRows = await db
        .select({
            id: assignments.id,
            assignedAt: assignments.assignedAt,
            title: learningSessions.title,
            summary: learningSessions.summary,
            moduleId: modules.id,
            materialId: modules.materialId,
            status: attempts.status,
            checkpointKind: sessionBlocks.kind,
        })
        .from(classMembers)
        .innerJoin(assignments, eq(assignments.classId, classMembers.classId))
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .leftJoin(
            attempts,
            and(
                eq(attempts.assignmentId, assignments.id),
                eq(attempts.studentId, classMembers.studentId),
            ),
        )
        .leftJoin(sessionBlocks, eq(sessionBlocks.id, attempts.currentBlockId))
        .where(
            and(
                eq(classMembers.studentId, studentId),
                eq(learningSessions.status, 'ready'),
            ),
        )
        .orderBy(asc(learningSessions.id));
    const bookIds = [...new Set(stageRows.map((row) => row.materialId))];
    const chapterRows =
        bookIds.length === 0
            ? []
            : await db
                  .select({
                      id: modules.id,
                      title: modules.title,
                      book: materials.title,
                      subject: materials.subject,
                  })
                  .from(modules)
                  .innerJoin(materials, eq(materials.id, modules.materialId))
                  .where(inArray(modules.materialId, bookIds))
                  .orderBy(
                      asc(materials.id),
                      asc(modules.firstPage),
                      asc(modules.id),
                  );

    return buildPath(chapterRows, stageRows);
}

export async function isStageLocked(
    db: Queryable,
    studentId: number,
    assignmentId: number,
) {
    const { subjects } = await pathOf(db, studentId);

    return subjects.some(({ chapters }) =>
        chapters.some(({ stages }) =>
            stages.some((stage) => stage.id === assignmentId && stage.locked),
        ),
    );
}

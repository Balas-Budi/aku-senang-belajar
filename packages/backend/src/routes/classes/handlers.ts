import { and, asc, count, countDistinct, eq, inArray } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { newInviteCode } from '../../auth/codes.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    attempts,
    classes,
    classMembers,
    learningSessions,
    materials,
    modules,
} from '../../db/schema.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { retryOnUniqueViolation } from '../../lib/unique-violation.ts';
import { visibleTo as bookVisibleTo } from '../materials/handlers.ts';
import { visibleTo as sessionVisibleTo } from '../studio/handlers.ts';
import { membersOf, ownedClassId } from './queries.ts';
import type { ChapterParams, ClassParams, CreateClassBody } from './schema.ts';

export async function createClass(
    request: FastifyRequest<{ Body: CreateClassBody }>,
    reply: FastifyReply,
) {
    const teacher = currentUser(request);

    const [classroom] = await retryOnUniqueViolation(() =>
        request.server.db
            .insert(classes)
            .values({
                teacherId: teacher.id,
                name: request.body.name,
                inviteCode: newInviteCode(),
            })
            .returning({
                id: classes.id,
                name: classes.name,
                inviteCode: classes.inviteCode,
            }),
    );

    return reply.code(201).send({ ...classroom, studentCount: 0 });
}

export async function listClasses(request: FastifyRequest) {
    const teacher = currentUser(request);

    return request.server.db
        .select({
            id: classes.id,
            name: classes.name,
            inviteCode: classes.inviteCode,
            studentCount: count(classMembers.studentId),
        })
        .from(classes)
        .leftJoin(classMembers, eq(classMembers.classId, classes.id))
        .where(eq(classes.teacherId, teacher.id))
        .groupBy(classes.id)
        .orderBy(asc(classes.name));
}

export async function listStudents(
    request: FastifyRequest<{ Params: ClassParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );

    return membersOf(db, classId);
}

export async function regenerateInviteCode(
    request: FastifyRequest<{ Params: ClassParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );

    const [classroom] = await retryOnUniqueViolation(() =>
        db
            .update(classes)
            .set({ inviteCode: newInviteCode() })
            .where(eq(classes.id, classId))
            .returning({ inviteCode: classes.inviteCode }),
    );

    if (!classroom?.inviteCode) {
        throw notFound('Class not found');
    }

    return { inviteCode: classroom.inviteCode };
}

export async function revokeInviteCode(
    request: FastifyRequest<{ Params: ClassParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );

    await db
        .update(classes)
        .set({ inviteCode: null })
        .where(eq(classes.id, classId));

    return reply.code(204).send();
}

export async function listChapters(
    request: FastifyRequest<{ Params: ClassParams }>,
) {
    const { db } = request.server;
    const teacherId = currentUser(request).id;
    const classId = await ownedClassId(db, request.params.classId, teacherId);
    const chapterRows = await db
        .select({
            id: modules.id,
            title: modules.title,
            bookId: materials.id,
            book: materials.title,
            subject: materials.subject,
            ownerId: materials.ownerId,
        })
        .from(modules)
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(bookVisibleTo(teacherId))
        .orderBy(asc(materials.id), asc(modules.firstPage), asc(modules.id));
    const readyRows = await db
        .select({
            moduleId: learningSessions.moduleId,
            assignmentId: assignments.id,
        })
        .from(learningSessions)
        .leftJoin(
            assignments,
            and(
                eq(assignments.learningSessionId, learningSessions.id),
                eq(assignments.classId, classId),
            ),
        )
        .where(
            and(
                eq(learningSessions.status, 'ready'),
                sessionVisibleTo(teacherId),
            ),
        );
    const openRows = await db
        .select({
            moduleId: learningSessions.moduleId,
            stages: countDistinct(assignments.id),
            attempts: count(attempts.id),
        })
        .from(assignments)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .leftJoin(attempts, eq(attempts.assignmentId, assignments.id))
        .where(eq(assignments.classId, classId))
        .groupBy(learningSessions.moduleId);
    const chapterOf = (row: (typeof chapterRows)[number]) => {
        const open = openRows.find(({ moduleId }) => moduleId === row.id);

        return {
            id: row.id,
            title: row.title,
            openStages: open?.stages ?? 0,
            waitingStages: readyRows.filter(
                ({ moduleId, assignmentId }) =>
                    moduleId === row.id && assignmentId === null,
            ).length,
            started: (open?.attempts ?? 0) > 0,
        };
    };

    return chapterRows
        .filter(
            (row, index) =>
                chapterRows.findIndex(({ bookId }) => bookId === row.bookId) ===
                index,
        )
        .map((first) => ({
            id: first.bookId,
            title: first.book,
            subject: first.subject,
            prepared: first.ownerId === null,
            chapters: chapterRows
                .filter(({ bookId }) => bookId === first.bookId)
                .map(chapterOf),
        }));
}

async function visibleChapterId(
    db: Queryable,
    moduleId: number,
    teacherId: number,
) {
    const [chapter] = await db
        .select({ id: modules.id })
        .from(modules)
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(and(eq(modules.id, moduleId), bookVisibleTo(teacherId)));

    if (!chapter) {
        throw notFound('Chapter not found');
    }

    return chapter.id;
}

export async function openChapter(
    request: FastifyRequest<{ Params: ChapterParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const teacherId = currentUser(request).id;
    const classId = await ownedClassId(db, request.params.classId, teacherId);
    const moduleId = await visibleChapterId(
        db,
        request.params.moduleId,
        teacherId,
    );
    const stages = await db
        .select({ id: learningSessions.id })
        .from(learningSessions)
        .where(
            and(
                eq(learningSessions.moduleId, moduleId),
                eq(learningSessions.status, 'ready'),
                sessionVisibleTo(teacherId),
            ),
        );

    if (stages.length === 0) {
        throw new AppError(409, {
            message: 'The chapter has no ready stage yet',
            code: 'CHAPTER_EMPTY',
        });
    }

    await db
        .insert(assignments)
        .values(stages.map(({ id }) => ({ learningSessionId: id, classId })))
        .onConflictDoNothing();

    return reply.code(204).send();
}

export async function closeChapter(
    request: FastifyRequest<{ Params: ChapterParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const teacherId = currentUser(request).id;
    const classId = await ownedClassId(db, request.params.classId, teacherId);
    const moduleId = await visibleChapterId(
        db,
        request.params.moduleId,
        teacherId,
    );

    await db.transaction(async (tx) => {
        // Locking the rows makes a student who starts right now wait, so no saved attempt is deleted.
        const opened = await tx
            .select({ id: assignments.id })
            .from(assignments)
            .innerJoin(
                learningSessions,
                eq(learningSessions.id, assignments.learningSessionId),
            )
            .where(
                and(
                    eq(assignments.classId, classId),
                    eq(learningSessions.moduleId, moduleId),
                ),
            )
            .for('update', { of: assignments });
        const ids = opened.map(({ id }) => id);

        if (ids.length === 0) return;

        const [started] = await tx
            .select({ id: attempts.id })
            .from(attempts)
            .where(inArray(attempts.assignmentId, ids))
            .limit(1);

        if (started) {
            throw new AppError(409, {
                message: 'A student has already started this chapter',
                code: 'CHAPTER_STARTED',
            });
        }

        await tx.delete(assignments).where(inArray(assignments.id, ids));
    });

    return reply.code(204).send();
}

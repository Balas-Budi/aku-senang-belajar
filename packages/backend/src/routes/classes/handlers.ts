import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { newInviteCode } from '../../auth/codes.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import { classes, classMembers, users } from '../../db/schema.ts';
import { AppError } from '../../lib/errors.ts';
import { retryOnUniqueViolation } from '../../lib/unique-violation.ts';
import type { ClassParams, CreateClassBody } from './schema.ts';

const notFound = () =>
    new AppError(404, { message: 'Class not found', code: 'NOT_FOUND' });

async function ownedClassId(
    db: Queryable,
    classId: number,
    teacherId: number,
): Promise<number> {
    const [classroom] = await db
        .select({ id: classes.id })
        .from(classes)
        .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
        .limit(1);

    if (!classroom) {
        throw notFound();
    }

    return classroom.id;
}

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

    return db
        .select({
            id: users.id,
            name: users.name,
            joinedAt: classMembers.joinedAt,
        })
        .from(classMembers)
        .innerJoin(users, eq(users.id, classMembers.studentId))
        .where(and(eq(classMembers.classId, classId), isNull(users.deletedAt)))
        .orderBy(asc(users.name));
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
        throw notFound();
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

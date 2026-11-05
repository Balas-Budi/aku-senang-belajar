import { asc, count, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { newInviteCode } from '../../auth/codes.ts';
import { currentUser } from '../../auth/guards.ts';
import { classes, classMembers } from '../../db/schema.ts';
import { notFound } from '../../lib/errors.ts';
import { retryOnUniqueViolation } from '../../lib/unique-violation.ts';
import { membersOf, ownedClassId } from './queries.ts';
import type { ClassParams, CreateClassBody } from './schema.ts';

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

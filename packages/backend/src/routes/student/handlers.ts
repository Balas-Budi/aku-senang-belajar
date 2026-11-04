import { and, asc, desc, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import {
    assignments,
    classes,
    classMembers,
    learningSessions,
    materials,
    modules,
} from '../../db/schema.ts';
import { AppError } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { isUniqueViolation } from '../../lib/unique-violation.ts';
import { classroomOf } from '../classes/queries.ts';
import type { JoinClassBody } from './schema.ts';

const alreadyInClass = () =>
    new AppError(409, {
        message: 'The student is already in a class',
        code: 'ALREADY_IN_CLASS',
    });

export async function myClass(request: FastifyRequest) {
    return {
        classroom: await classroomOf(
            request.server.db,
            currentUser(request).id,
        ),
    };
}

export async function joinClass(
    request: FastifyRequest<{ Body: JoinClassBody }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const student = currentUser(request);

    if (await classroomOf(db, student.id)) {
        throw alreadyInClass();
    }

    const [target] = await db
        .select({ id: classes.id })
        .from(classes)
        .where(eq(classes.inviteCode, request.body.inviteCode))
        .limit(1);

    if (!target) {
        throw fieldError('inviteCode', 'Class code not found');
    }

    await db
        .insert(classMembers)
        .values({ studentId: student.id, classId: target.id })
        .catch((error: unknown) => {
            throw isUniqueViolation(error) ? alreadyInClass() : error;
        });

    return reply
        .code(201)
        .send({ classroom: await classroomOf(db, student.id) });
}

export async function myAssignments(request: FastifyRequest) {
    return request.server.db
        .select({
            id: assignments.id,
            title: learningSessions.title,
            summary: learningSessions.summary,
            subject: materials.subject,
            moduleTitle: modules.title,
        })
        .from(classMembers)
        .innerJoin(assignments, eq(assignments.classId, classMembers.classId))
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(classMembers.studentId, currentUser(request).id),
                eq(learningSessions.status, 'ready'),
            ),
        )
        .orderBy(desc(assignments.assignedAt), asc(assignments.id));
}

export async function leaveClass(request: FastifyRequest, reply: FastifyReply) {
    await request.server.db
        .delete(classMembers)
        .where(eq(classMembers.studentId, currentUser(request).id));

    return reply.code(204).send();
}

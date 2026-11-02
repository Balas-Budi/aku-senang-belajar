import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import { clearSessionCookie, deleteUserSessions } from '../../auth/sessions.ts';
import { users } from '../../db/schema.ts';
import { AppError } from '../../lib/errors.ts';
import { publicUserColumns } from '../auth/handlers.ts';
import type { ChangeRoleBody, UserParams } from './schema.ts';

export async function deleteMe(request: FastifyRequest, reply: FastifyReply) {
    const { id } = currentUser(request);

    await request.server.db.transaction(async (tx) => {
        await tx
            .update(users)
            .set({ deletedAt: new Date() })
            .where(eq(users.id, id));
        await deleteUserSessions(tx, id);
    });

    clearSessionCookie(reply, request.server.env);

    return reply.code(204).send();
}

export async function changeRole(
    request: FastifyRequest<{ Params: UserParams; Body: ChangeRoleBody }>,
) {
    const { db } = request.server;
    const where = and(eq(users.id, request.params.id), isNull(users.deletedAt));

    const [target] = await db
        .select({ role: users.role })
        .from(users)
        .where(where)
        .limit(1);

    if (!target) {
        throw new AppError(404, {
            message: 'User not found',
            code: 'NOT_FOUND',
        });
    }

    if (target.role === 'student') {
        throw new AppError(400, {
            message: 'Input values are invalid',
            code: 'VALIDATION_ERROR',
            context: {
                public: [
                    {
                        field: 'role',
                        message: 'A student account cannot change role',
                    },
                ],
            },
        });
    }

    const [user] = await db
        .update(users)
        .set({ role: request.body.role })
        .where(where)
        .returning(publicUserColumns);

    return user;
}

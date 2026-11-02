import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import {
    dummyHash,
    hashPassword,
    needsRehash,
    verifyPassword,
} from '../../auth/password.ts';
import {
    clearSessionCookie,
    createSession,
    deleteExpiredSessions,
    deleteSession,
    deleteUserSessions,
    setSessionCookie,
} from '../../auth/sessions.ts';
import { users } from '../../db/schema.ts';
import { fieldError } from '../../lib/field-error.ts';
import { AppError } from '../../lib/errors.ts';
import type { ChangePasswordBody, LoginBody } from './schema.ts';

export const publicUserColumns = {
    id: users.id,
    role: users.role,
    name: users.name,
    username: users.username,
};

export async function login(
    request: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply,
) {
    const { db, env } = request.server;
    const { username, password } = request.body;

    const [user] = await db
        .select({ ...publicUserColumns, passwordHash: users.passwordHash })
        .from(users)
        .where(and(eq(users.username, username), isNull(users.deletedAt)))
        .limit(1);

    const valid = await verifyPassword(
        user?.passwordHash ?? dummyHash,
        password,
    );

    if (!user || !valid) {
        throw new AppError(401, {
            message: 'The login details are incorrect',
            code: 'INVALID_CREDENTIALS',
        });
    }

    if (needsRehash(user.passwordHash)) {
        await db
            .update(users)
            .set({ passwordHash: await hashPassword(password) })
            .where(eq(users.id, user.id));
    }

    await deleteExpiredSessions(db, user.id);

    if (request.user) {
        await deleteSession(db, request.user.sessionId);
    }

    setSessionCookie(
        reply,
        env,
        await createSession(db, user.id, request.headers['user-agent']),
    );

    return {
        id: user.id,
        role: user.role,
        name: user.name,
        username: user.username,
    };
}

export async function logout(request: FastifyRequest, reply: FastifyReply) {
    await deleteSession(request.server.db, currentUser(request).sessionId);
    clearSessionCookie(reply, request.server.env);

    return reply.code(204).send();
}

export async function logoutAll(request: FastifyRequest, reply: FastifyReply) {
    await deleteUserSessions(request.server.db, currentUser(request).id);
    clearSessionCookie(reply, request.server.env);

    return reply.code(204).send();
}

export async function me(request: FastifyRequest) {
    const { id, role, name, username } = currentUser(request);

    return { id, role, name, username };
}

export async function changePassword(
    request: FastifyRequest<{ Body: ChangePasswordBody }>,
    reply: FastifyReply,
) {
    const { db, env } = request.server;
    const user = currentUser(request);
    const { currentPassword, newPassword } = request.body;

    const [stored] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, user.id));

    if (!(await verifyPassword(stored.passwordHash, currentPassword))) {
        throw fieldError('currentPassword', 'Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);
    const token = await db.transaction(async (tx) => {
        await tx
            .update(users)
            .set({ passwordHash })
            .where(eq(users.id, user.id));
        await deleteUserSessions(tx, user.id);

        return createSession(tx, user.id, request.headers['user-agent']);
    });

    setSessionCookie(reply, env, token);

    return reply.code(204).send();
}

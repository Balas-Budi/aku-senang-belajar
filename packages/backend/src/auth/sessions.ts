import { createHash, randomBytes } from 'node:crypto';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply } from 'fastify';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import type { RequestUser } from './guards.ts';
import type { Queryable } from '../db/index.ts';
import { sessions, users } from '../db/schema.ts';
import type { Env } from '../env.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const SESSION_LIFETIME = 30 * DAY;
export const IDLE_TIMEOUT = 7 * DAY;
const TOUCH_INTERVAL = HOUR;

export function sessionCookie(env: Env): {
    name: string;
    options: CookieSerializeOptions;
} {
    const production = env.NODE_ENV === 'production';

    return {
        name: production ? '__Host-session' : 'session',
        options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: production,
            maxAge: SESSION_LIFETIME / 1000,
        },
    };
}

export function setSessionCookie(
    reply: FastifyReply,
    env: Env,
    token: string,
): void {
    const { name, options } = sessionCookie(env);

    reply.setCookie(name, token, options);
}

export function clearSessionCookie(reply: FastifyReply, env: Env): void {
    const { name, options } = sessionCookie(env);

    reply.clearCookie(name, {
        httpOnly: options.httpOnly,
        sameSite: options.sameSite,
        path: options.path,
        secure: options.secure,
    });
}

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('base64url');
}

export async function createSession(
    db: Queryable,
    userId: number,
    userAgent: string | undefined,
): Promise<string> {
    const token = randomBytes(32).toString('base64url');

    await db.insert(sessions).values({
        id: hashToken(token),
        userId,
        userAgent,
        expiresAt: new Date(Date.now() + SESSION_LIFETIME),
    });

    return token;
}

export async function findSession(
    db: Queryable,
    token: string,
): Promise<RequestUser | undefined> {
    const now = Date.now();
    const [row] = await db
        .select({
            sessionId: sessions.id,
            lastSeenAt: sessions.lastSeenAt,
            id: users.id,
            role: users.role,
            name: users.name,
            username: users.username,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(
            and(
                eq(sessions.id, hashToken(token)),
                isNull(users.deletedAt),
                gt(sessions.expiresAt, new Date(now)),
                gt(sessions.lastSeenAt, new Date(now - IDLE_TIMEOUT)),
            ),
        )
        .limit(1);

    if (!row) {
        return undefined;
    }

    if (now - row.lastSeenAt.getTime() > TOUCH_INTERVAL) {
        await db
            .update(sessions)
            .set({ lastSeenAt: new Date(now) })
            .where(eq(sessions.id, row.sessionId));
    }

    return {
        id: row.id,
        role: row.role,
        name: row.name,
        username: row.username,
        sessionId: row.sessionId,
    };
}

export async function deleteSession(
    db: Queryable,
    sessionId: string,
): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteUserSessions(
    db: Queryable,
    userId: number,
): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteExpiredSessions(
    db: Queryable,
    userId: number,
): Promise<void> {
    const now = Date.now();

    await db
        .delete(sessions)
        .where(
            and(
                eq(sessions.userId, userId),
                or(
                    lt(sessions.expiresAt, new Date(now)),
                    lt(sessions.lastSeenAt, new Date(now - IDLE_TIMEOUT)),
                ),
            ),
        );
}

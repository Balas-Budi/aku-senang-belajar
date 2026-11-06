import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import type { FastifyInstance } from 'fastify';
import type { AiConfig } from '../src/ai/chat.ts';
import { buildApp } from '../src/app.ts';
import type { Role } from '../src/auth/guards.ts';
import { users } from '../src/db/schema.ts';
import { loadEnv, type Env } from '../src/env.ts';
import { hashPassword } from '../src/auth/password.ts';

export const TEST_ORIGIN = 'http://127.0.0.1:4200';
export const TEST_PASSWORD = 'correct horse battery staple';
export const TEST_STUDENT_PASSWORD = 'kid pass 42';

export function testDatabaseUrl(): string {
    const url = process.env.TEST_DATABASE_URL;

    if (!url) {
        throw new Error(
            'TEST_DATABASE_URL is not set. Point it at a database the tests may write to, separate from DATABASE_URL.',
        );
    }

    if (url === process.env.DATABASE_URL) {
        throw new Error(
            'TEST_DATABASE_URL equals DATABASE_URL. Tests write rows; give them their own database.',
        );
    }

    return url;
}

export function testEnv(ai?: AiConfig): Env {
    return loadEnv({
        NODE_ENV: 'test',
        DATABASE_URL: testDatabaseUrl(),
        LOG_LEVEL: 'silent',
        ...(ai && {
            AI_BASE_URL: ai.baseUrl,
            AI_API_KEY: ai.apiKey,
            AI_MODEL: ai.model,
        }),
    });
}

export async function testApp(
    t: TestContext,
    ai?: AiConfig,
): Promise<FastifyInstance> {
    const app = await buildApp(testEnv(ai));

    t.after(() => app.close());

    return app;
}

export function randomUsername(prefix = 'user'): string {
    return `${prefix}-${randomUUID().slice(0, 12)}`;
}

export async function createUser(
    app: FastifyInstance,
    role: Exclude<Role, 'student'> = 'teacher',
) {
    const username = randomUsername('teacher');
    const [user] = await app.db
        .insert(users)
        .values({
            role,
            name: 'Test Teacher',
            username,
            passwordHash: await hashPassword(TEST_PASSWORD),
        })
        .returning({ id: users.id });

    return { id: user.id, username };
}

export async function createStudent(app: FastifyInstance, name = 'Budi') {
    const username = randomUsername('student');
    const [student] = await app.db
        .insert(users)
        .values({
            role: 'student',
            name,
            username,
            passwordHash: await hashPassword(TEST_STUDENT_PASSWORD),
        })
        .returning({ id: users.id });

    return { id: student.id, username };
}

export async function loginAs(
    app: FastifyInstance,
    username: string,
    password = TEST_PASSWORD,
): Promise<string> {
    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: TEST_ORIGIN },
        payload: { username, password },
    });
    const cookie = response.cookies.find((entry) => entry.name === 'session');

    if (!cookie) {
        throw new Error(
            `Login for ${username} answered ${response.statusCode} without a session cookie`,
        );
    }

    return cookie.value;
}

export async function createClass(app: FastifyInstance, teacherToken: string) {
    const response = await app.inject({
        method: 'POST',
        url: '/api/classes',
        headers: { origin: TEST_ORIGIN },
        cookies: { session: teacherToken },
        payload: { name: 'Kelas 4A' },
    });

    if (response.statusCode !== 201) {
        throw new Error(`Creating a class answered ${response.statusCode}`);
    }

    const body: { id: number; inviteCode: string } = response.json();

    return body;
}

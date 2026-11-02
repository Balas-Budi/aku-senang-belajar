import assert from 'node:assert/strict';
import { argon2Sync, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { sessions, users } from '../src/db/schema.ts';
import { hashToken } from '../src/auth/sessions.ts';
import {
    createUser,
    loginAs,
    randomUsername,
    TEST_ORIGIN,
    TEST_PASSWORD,
    testApp,
} from './helpers.ts';

const write = { origin: TEST_ORIGIN };

function me(app: FastifyInstance, token?: string) {
    return app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: token ? { session: token } : {},
    });
}

test('there is no public registration: accounts come from an admin', async (t) => {
    const app = await testApp(t);
    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: write,
        payload: {
            name: 'Bu Sari',
            username: randomUsername(),
            password: TEST_PASSWORD,
        },
    });

    assert.equal(response.statusCode, 404);
});

test('login answers the public user, sets a safe session cookie, and leaks no secret', async (t) => {
    const app = await testApp(t);
    const { id, username } = await createUser(app);
    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: write,
        payload: {
            username: `  ${username.toUpperCase()} `,
            password: TEST_PASSWORD,
        },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
        id,
        role: 'teacher',
        name: 'Test Teacher',
        username,
    });

    const cookie = response.cookies.find((entry) => entry.name === 'session');

    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Lax');
    assert.equal(cookie.path, '/');
    assert.ok(!response.body.includes(cookie.value));
    assert.equal((await me(app, cookie.value)).json().username, username);
});

test('login gives the same answer for a wrong password and an unknown username', async (t) => {
    const app = await testApp(t);
    const { username } = await createUser(app);
    const attempt = (payload: { username: string; password: string }) =>
        app.inject({
            method: 'POST',
            url: '/api/auth/login',
            headers: write,
            payload,
        });

    const wrongPassword = await attempt({
        username,
        password: 'not the password',
    });
    const unknownUsername = await attempt({
        username: randomUsername(),
        password: TEST_PASSWORD,
    });

    assert.equal(wrongPassword.statusCode, 401);
    assert.equal(wrongPassword.json().name, 'INVALID_CREDENTIALS');
    assert.deepEqual(unknownUsername.json(), wrongPassword.json());
    assert.equal(unknownUsername.statusCode, 401);
    assert.equal(wrongPassword.cookies.length, 0);
});

test('login replaces the session the browser arrived with', async (t) => {
    const app = await testApp(t);
    const { username } = await createUser(app);
    const first = await loginAs(app, username);
    const second = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: write,
        cookies: { session: first },
        payload: { username, password: TEST_PASSWORD },
    });

    assert.equal(second.statusCode, 200);
    assert.equal((await me(app, first)).statusCode, 401);
});

test('login rehashes a password stored with older parameters', async (t) => {
    const app = await testApp(t);
    const { id, username } = await createUser(app);
    const salt = randomBytes(16);
    const tag = argon2Sync('argon2id', {
        message: TEST_PASSWORD,
        nonce: salt,
        memory: 8192,
        passes: 2,
        parallelism: 1,
        tagLength: 32,
    });
    const base64 = (buffer: Buffer) =>
        buffer.toString('base64').replace(/=+$/, '');

    await app.db
        .update(users)
        .set({
            passwordHash: `$argon2id$v=19$m=8192,t=2,p=1$${base64(salt)}$${base64(tag)}`,
        })
        .where(eq(users.id, id));

    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: write,
        payload: { username, password: TEST_PASSWORD },
    });
    const [stored] = await app.db.select().from(users).where(eq(users.id, id));

    assert.equal(response.statusCode, 200);
    assert.match(
        stored.passwordHash ?? '',
        /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/,
    );
});

test('me is 401 without a valid, live session', async (t) => {
    const app = await testApp(t);
    const { id, username } = await createUser(app);

    assert.equal((await me(app)).statusCode, 401);
    assert.equal((await me(app, 'not-a-real-token')).statusCode, 401);

    const expired = await loginAs(app, username);
    await app.db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(sessions.id, hashToken(expired)));
    assert.equal((await me(app, expired)).statusCode, 401);

    const idle = await loginAs(app, username);
    await app.db
        .update(sessions)
        .set({ lastSeenAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
        .where(eq(sessions.id, hashToken(idle)));
    assert.equal((await me(app, idle)).statusCode, 401);

    const live = await loginAs(app, username);
    assert.equal((await me(app, live)).statusCode, 200);
    await app.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, id));
    assert.equal((await me(app, live)).statusCode, 401);
});

test('an active session refreshes lastSeenAt at most once an hour', async (t) => {
    const app = await testApp(t);
    const { username } = await createUser(app);
    const token = await loginAs(app, username);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    await app.db
        .update(sessions)
        .set({ lastSeenAt: twoHoursAgo })
        .where(eq(sessions.id, hashToken(token)));
    await me(app, token);

    const [row] = await app.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, hashToken(token)));

    assert.ok(
        row.lastSeenAt.getTime() > twoHoursAgo.getTime() + 60 * 60 * 1000,
    );
});

test('logout ends this session only, logout-all ends every session', async (t) => {
    const app = await testApp(t);
    const { username } = await createUser(app);
    const phone = await loginAs(app, username);
    const laptop = await loginAs(app, username);

    const logout = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: write,
        cookies: { session: phone },
    });

    assert.equal(logout.statusCode, 204);
    assert.equal((await me(app, phone)).statusCode, 401);
    assert.equal((await me(app, laptop)).statusCode, 200);

    const tablet = await loginAs(app, username);
    const logoutAll = await app.inject({
        method: 'POST',
        url: '/api/auth/logout-all',
        headers: write,
        cookies: { session: laptop },
    });

    assert.equal(logoutAll.statusCode, 204);
    assert.equal((await me(app, laptop)).statusCode, 401);
    assert.equal((await me(app, tablet)).statusCode, 401);
});

test('a password change ends every other session and keeps this browser signed in', async (t) => {
    const app = await testApp(t);
    const { username } = await createUser(app);
    const here = await loginAs(app, username);
    const elsewhere = await loginAs(app, username);
    const change = (currentPassword: string) =>
        app.inject({
            method: 'PUT',
            url: '/api/auth/password',
            headers: write,
            cookies: { session: here },
            payload: {
                currentPassword,
                newPassword: 'a brand new long passphrase',
            },
        });

    const wrong = await change('not the password');

    assert.equal(wrong.statusCode, 400);
    assert.equal(wrong.json().details[0].field, 'currentPassword');

    const right = await change(TEST_PASSWORD);
    const renewed = right.cookies.find((entry) => entry.name === 'session');

    assert.equal(right.statusCode, 204);
    assert.ok(renewed);
    assert.equal((await me(app, here)).statusCode, 401);
    assert.equal((await me(app, elsewhere)).statusCode, 401);
    assert.equal((await me(app, renewed.value)).statusCode, 200);
});

test('the sixth login attempt in the window is rate limited through the envelope', async (t) => {
    const app = await testApp(t);
    const username = randomUsername();
    const attempt = () =>
        app.inject({
            method: 'POST',
            url: '/api/auth/login',
            headers: write,
            payload: { username, password: 'not the password' },
        });

    for (let i = 0; i < 5; i += 1) {
        assert.equal((await attempt()).statusCode, 401);
    }

    const blocked = await attempt();

    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.json().name, 'RATE_LIMITED');
});

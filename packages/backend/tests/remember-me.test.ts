import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import { sessions } from '../src/db/schema.ts';
import { hashToken } from '../src/auth/sessions.ts';
import { createUser, TEST_PASSWORD, TEST_ORIGIN, testApp } from './helpers.ts';

for (const rememberMe of [undefined, false, true]) {
    test(`login rememberMe=${String(rememberMe)} aligns cookie and server expiration`, async (t) => {
        const app = await testApp(t);
        const { username } = await createUser(app);
        const before = Date.now();
        const login = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            headers: { origin: TEST_ORIGIN },
            payload: {
                username,
                password: TEST_PASSWORD,
                ...(rememberMe === undefined ? {} : { rememberMe }),
            },
        });
        assert.equal(login.statusCode, 200);
        const cookie = login.cookies.find((item) => item.name === 'session');
        assert.ok(cookie);
        const lifetime = (rememberMe ? 30 * 24 : 24) * 60 * 60;
        assert.ok(
            Number(cookie.maxAge) <= lifetime &&
                Number(cookie.maxAge) >= lifetime - 2,
        );
        assert.equal(cookie.httpOnly, true);
        assert.equal(cookie.sameSite, 'Lax');
        const stored = await app.db.query.sessions.findFirst({
            where: eq(sessions.id, hashToken(cookie.value)),
        });
        assert.ok(stored);
        assert.ok(stored.expiresAt.getTime() >= before + lifetime * 1000);
        assert.ok(stored.expiresAt.getTime() <= Date.now() + lifetime * 1000);
        const changed = await app.inject({
            method: 'PUT',
            url: '/api/auth/password',
            headers: { origin: TEST_ORIGIN },
            cookies: { session: cookie.value },
            payload: {
                currentPassword: TEST_PASSWORD,
                newPassword: 'a new password for this session',
            },
        });
        assert.equal(changed.statusCode, 204);
        const renewed = changed.cookies.find((item) => item.name === 'session');
        assert.ok(renewed);
        const renewedRow = await app.db.query.sessions.findFirst({
            where: eq(sessions.id, hashToken(renewed.value)),
        });
        assert.ok(renewedRow);
        assert.equal(
            renewedRow.expiresAt.getTime(),
            stored.expiresAt.getTime(),
        );
        assert.ok(Number(renewed.maxAge) <= lifetime);
    });
}

test('rememberMe rejects non-boolean input', async (t) => {
    const app = await testApp(t);
    const result = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: TEST_ORIGIN },
        payload: {
            username: 'test-user',
            password: TEST_PASSWORD,
            rememberMe: 'true',
        },
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.json().name, 'VALIDATION_ERROR');
    assert.equal(result.json().details[0].field, 'rememberMe');
});

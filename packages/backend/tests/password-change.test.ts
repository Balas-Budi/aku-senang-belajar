import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createStudent,
    createUser,
    loginAs,
    TEST_ORIGIN,
    TEST_PASSWORD,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';

for (const role of ['student', 'teacher', 'admin'] as const) {
    test(`${role} changes their own password and invalidates older sessions`, async (t) => {
        const app = await testApp(t);
        const user =
            role === 'student'
                ? await createStudent(app)
                : await createUser(app, role);
        const currentPassword =
            role === 'student' ? TEST_STUDENT_PASSWORD : TEST_PASSWORD;
        const newPassword =
            role === 'student' ? 'new pass' : 'a new personal passphrase';
        const current = await loginAs(app, user.username, currentPassword);
        const other = await loginAs(app, user.username, currentPassword);
        const change = (oldPassword: string, replacement: string) =>
            app.inject({
                method: 'PUT',
                url: '/api/auth/password',
                headers: { origin: TEST_ORIGIN },
                cookies: { session: current },
                payload: {
                    currentPassword: oldPassword,
                    newPassword: replacement,
                },
            });
        const short = await change(
            currentPassword,
            role === 'student' ? 'short' : 'eightchr',
        );
        assert.equal(short.statusCode, 400);
        assert.equal(short.json().name, 'VALIDATION_ERROR');
        assert.equal(short.json().details[0].field, 'newPassword');
        const wrong = await change('wrong current password', newPassword);
        assert.equal(wrong.statusCode, 400);
        assert.equal(wrong.json().details[0].field, 'currentPassword');
        const result = await change(currentPassword, newPassword);
        assert.equal(result.statusCode, 204);
        const renewed = result.cookies.find(
            (cookie) => cookie.name === 'session',
        );
        assert.ok(renewed);
        for (const token of [current, other])
            assert.equal(
                (
                    await app.inject({
                        method: 'GET',
                        url: '/api/auth/me',
                        cookies: { session: token },
                    })
                ).statusCode,
                401,
            );
        assert.equal(
            (
                await app.inject({
                    method: 'GET',
                    url: '/api/auth/me',
                    cookies: { session: renewed.value },
                })
            ).statusCode,
            200,
        );
        assert.equal(
            (
                await app.inject({
                    method: 'POST',
                    url: '/api/auth/login',
                    headers: { origin: TEST_ORIGIN },
                    payload: {
                        username: user.username,
                        password: currentPassword,
                    },
                })
            ).statusCode,
            401,
        );
        await loginAs(app, user.username, newPassword);
    });
}

test('password changes require an authenticated user', async (t) => {
    const app = await testApp(t);
    const result = await app.inject({
        method: 'PUT',
        url: '/api/auth/password',
        headers: { origin: TEST_ORIGIN },
        payload: {
            currentPassword: TEST_PASSWORD,
            newPassword: 'a new personal passphrase',
        },
    });
    assert.equal(result.statusCode, 401);
    assert.equal(result.json().name, 'UNAUTHORIZED');
});

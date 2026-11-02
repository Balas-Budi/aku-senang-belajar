import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createUser,
    loginAs,
    TEST_ORIGIN,
    TEST_PASSWORD,
    testApp,
} from './helpers.ts';

const write = { origin: TEST_ORIGIN };

test('deleting the account ends its sessions and blocks the next login', async (t) => {
    const app = await testApp(t);
    const { username } = await createUser(app);
    const token = await loginAs(app, username);

    const deleted = await app.inject({
        method: 'DELETE',
        url: '/api/users/me',
        headers: write,
        cookies: { session: token },
    });

    assert.equal(deleted.statusCode, 204);

    const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { session: token },
    });
    const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: write,
        payload: { username, password: TEST_PASSWORD },
    });

    assert.equal(me.statusCode, 401);
    assert.equal(login.statusCode, 401);
});

test('only an admin changes a role, and only through the role route', async (t) => {
    const app = await testApp(t);
    const target = await createUser(app);
    const user = await createUser(app);
    const admin = await createUser(app, 'admin');
    const changeRole = (token: string | undefined, id: number) =>
        app.inject({
            method: 'PUT',
            url: `/api/users/${id}/role`,
            headers: write,
            cookies: token ? { session: token } : {},
            payload: { role: 'admin' },
        });

    assert.equal((await changeRole(undefined, target.id)).statusCode, 401);
    assert.equal(
        (await changeRole(await loginAs(app, user.username), target.id))
            .statusCode,
        403,
    );

    const adminToken = await loginAs(app, admin.username);
    const promoted = await changeRole(adminToken, target.id);

    assert.equal(promoted.statusCode, 200);
    assert.deepEqual(promoted.json(), {
        id: target.id,
        role: 'admin',
        name: 'Test Teacher',
        username: target.username,
    });
    assert.equal((await changeRole(adminToken, 2_000_000_000)).statusCode, 404);
});

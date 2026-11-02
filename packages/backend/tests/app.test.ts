import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadEnv } from '../src/env.ts';
import { testApp } from './helpers.ts';

test('an unknown route answers the central 404 envelope', async (t) => {
    const app = await testApp(t);
    const response = await app.inject({ method: 'GET', url: '/api/nope' });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
        name: 'NOT_FOUND',
        message: 'Route GET /api/nope does not exist',
    });
});

test('a write without an Origin header is rejected', async (t) => {
    const app = await testApp(t);
    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'a@example.test', password: 'x' },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().name, 'INVALID_ORIGIN');
});

test('a write from another origin is rejected, even as text/plain', async (t) => {
    const app = await testApp(t);
    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
            origin: 'https://evil.example',
            'content-type': 'text/plain',
        },
        payload: 'anything',
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().name, 'INVALID_ORIGIN');
});

test('the env refuses a missing DATABASE_URL and normalises APP_ORIGIN', () => {
    assert.throws(() => loadEnv({}), /DATABASE_URL/);

    const env = loadEnv({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
        APP_ORIGIN: 'https://belajar.example/',
    });

    assert.equal(env.APP_ORIGIN, 'https://belajar.example');
});

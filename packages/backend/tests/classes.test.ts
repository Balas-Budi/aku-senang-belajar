import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
    createClass,
    createStudent,
    createUser,
    loginAs,
    TEST_ORIGIN,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';

const write = { origin: TEST_ORIGIN };

function as(token: string): Record<string, string> {
    return { session: token };
}

async function teacherWithClass(app: FastifyInstance) {
    const teacher = await createUser(app);
    const token = await loginAs(app, teacher.username);
    const classroom = await createClass(app, token);

    return { token, classroom };
}

async function signedInStudent(app: FastifyInstance, name = 'Budi') {
    const student = await createStudent(app, name);
    const token = await loginAs(app, student.username, TEST_STUDENT_PASSWORD);

    return { ...student, token };
}

function joinClass(app: FastifyInstance, token: string, inviteCode: string) {
    return app.inject({
        method: 'POST',
        url: '/api/student/class',
        headers: write,
        cookies: as(token),
        payload: { inviteCode },
    });
}

function myClass(app: FastifyInstance, token: string) {
    return app.inject({
        method: 'GET',
        url: '/api/student/class',
        cookies: as(token),
    });
}

test('a teacher creates and lists their classes, each with a six-character invite code (FR-002)', async (t) => {
    const app = await testApp(t);
    const { token, classroom } = await teacherWithClass(app);
    const second = await createClass(app, token);

    assert.match(classroom.inviteCode, /^[A-Z2-9]{6}$/);

    const list = await app.inject({
        method: 'GET',
        url: '/api/classes',
        cookies: as(token),
    });

    assert.equal(list.statusCode, 200);
    assert.deepEqual(
        list
            .json()
            .map((entry: { id: number }) => entry.id)
            .sort(),
        [classroom.id, second.id].sort(),
    );
});

test('a student signs in with username and password, like a teacher', async (t) => {
    const app = await testApp(t);
    const student = await createStudent(app, 'Sari');

    const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: write,
        payload: {
            username: student.username.toUpperCase(),
            password: TEST_STUDENT_PASSWORD,
        },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
        id: student.id,
        role: 'student',
        name: 'Sari',
        username: student.username,
    });
});

test('a student without a class sees no class, then joins with the class code', async (t) => {
    const app = await testApp(t);
    const { token: teacherToken, classroom } = await teacherWithClass(app);
    const student = await signedInStudent(app);

    assert.deepEqual((await myClass(app, student.token)).json(), {
        classroom: null,
    });

    const joined = await joinClass(
        app,
        student.token,
        classroom.inviteCode.toLowerCase(),
    );

    assert.equal(joined.statusCode, 201);
    assert.equal(joined.json().classroom.id, classroom.id);
    assert.equal(joined.json().classroom.teacherName, 'Test Teacher');
    assert.equal(
        (await myClass(app, student.token)).json().classroom.name,
        'Kelas 4A',
    );

    const roster = await app.inject({
        method: 'GET',
        url: `/api/classes/${classroom.id}/students`,
        cookies: as(teacherToken),
    });

    assert.deepEqual(
        roster.json().map((entry: { name: string }) => entry.name),
        ['Budi'],
    );
});

test('a student is in one class at most', async (t) => {
    const app = await testApp(t);
    const { classroom } = await teacherWithClass(app);
    const { classroom: other } = await teacherWithClass(app);
    const student = await signedInStudent(app);

    assert.equal(
        (await joinClass(app, student.token, classroom.inviteCode)).statusCode,
        201,
    );

    const second = await joinClass(app, student.token, other.inviteCode);

    assert.equal(second.statusCode, 409);
    assert.equal(second.json().name, 'ALREADY_IN_CLASS');
    assert.equal(
        (await myClass(app, student.token)).json().classroom.id,
        classroom.id,
    );
});

test('a student leaves the class and can then join another', async (t) => {
    const app = await testApp(t);
    const { classroom } = await teacherWithClass(app);
    const { classroom: next } = await teacherWithClass(app);
    const student = await signedInStudent(app);

    await joinClass(app, student.token, classroom.inviteCode);

    const left = await app.inject({
        method: 'DELETE',
        url: '/api/student/class',
        headers: write,
        cookies: as(student.token),
    });

    assert.equal(left.statusCode, 204);
    assert.deepEqual((await myClass(app, student.token)).json(), {
        classroom: null,
    });
    assert.equal(
        (await joinClass(app, student.token, next.inviteCode)).statusCode,
        201,
    );
});

test('an unknown or revoked class code cannot be used, and a new code can', async (t) => {
    const app = await testApp(t);
    const { token, classroom } = await teacherWithClass(app);
    const student = await signedInStudent(app);

    const unknown = await joinClass(app, student.token, 'ZZZZZZ');

    assert.equal(unknown.statusCode, 400);
    assert.equal(unknown.json().details[0].field, 'inviteCode');

    const revoke = await app.inject({
        method: 'DELETE',
        url: `/api/classes/${classroom.id}/invite-code`,
        headers: write,
        cookies: as(token),
    });

    assert.equal(revoke.statusCode, 204);
    assert.equal(
        (await joinClass(app, student.token, classroom.inviteCode)).statusCode,
        400,
    );

    const fresh = await app.inject({
        method: 'POST',
        url: `/api/classes/${classroom.id}/invite-code`,
        headers: write,
        cookies: as(token),
    });

    assert.notEqual(fresh.json().inviteCode, classroom.inviteCode);
    assert.equal(
        (await joinClass(app, student.token, fresh.json().inviteCode))
            .statusCode,
        201,
    );
});

test("a teacher cannot see another teacher's class (AT-11)", async (t) => {
    const app = await testApp(t);
    const { classroom } = await teacherWithClass(app);
    const other = await createUser(app);
    const otherToken = await loginAs(app, other.username);

    const roster = await app.inject({
        method: 'GET',
        url: `/api/classes/${classroom.id}/students`,
        cookies: as(otherToken),
    });
    const list = await app.inject({
        method: 'GET',
        url: '/api/classes',
        cookies: as(otherToken),
    });

    assert.equal(roster.statusCode, 404);
    assert.deepEqual(list.json(), []);
});

test('a student cannot reach teacher or admin routes, or change a password or the account', async (t) => {
    const app = await testApp(t);
    const student = await signedInStudent(app);
    const call = (
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        url: string,
        payload?: object,
    ) =>
        app.inject({
            method,
            url,
            headers: write,
            cookies: as(student.token),
            payload,
        });

    assert.equal((await call('GET', '/api/classes')).statusCode, 403);
    assert.equal(
        (await call('POST', '/api/classes', { name: 'Kelas palsu' }))
            .statusCode,
        403,
    );
    assert.equal(
        (await call('GET', '/api/admin/users?role=student')).statusCode,
        403,
    );
    assert.equal(
        (
            await call('PUT', '/api/auth/password', {
                currentPassword: TEST_STUDENT_PASSWORD,
                newPassword: 'a long enough passphrase',
            })
        ).statusCode,
        403,
    );
    assert.equal((await call('DELETE', '/api/users/me')).statusCode, 403);
});

test('a teacher cannot use the student class routes', async (t) => {
    const app = await testApp(t);
    const { token, classroom } = await teacherWithClass(app);

    assert.equal(
        (await joinClass(app, token, classroom.inviteCode)).statusCode,
        403,
    );
});

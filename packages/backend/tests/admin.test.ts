import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { users } from '../src/db/schema.ts';
import {
    createClass,
    createStudent,
    createUser,
    loginAs,
    randomUsername,
    TEST_ORIGIN,
    TEST_PASSWORD,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';

const write = { origin: TEST_ORIGIN };
const XLSX =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function fixture(name: string): Buffer {
    return readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
}

async function adminCaller(app: FastifyInstance) {
    const admin = await createUser(app, 'admin');
    const token = await loginAs(app, admin.username);

    return (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
        app.inject({
            method,
            url,
            headers: write,
            cookies: { session: token },
            payload,
        });
}

function login(app: FastifyInstance, username: string, password: string) {
    return app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: write,
        payload: { username, password },
    });
}

test('an admin registers a teacher; a generated password is 16 characters and works once shown', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const username = randomUsername('guru');

    const created = await call('POST', '/api/admin/users', {
        role: 'teacher',
        name: 'Bu Sari',
        username,
    });

    assert.equal(created.statusCode, 201);
    assert.equal(created.json().role, 'teacher');
    assert.match(created.json().generatedPassword, /^[a-z2-9]{16}$/);

    const signedIn = await login(
        app,
        username,
        created.json().generatedPassword,
    );

    assert.equal(signedIn.statusCode, 200);
    assert.equal(signedIn.json().role, 'teacher');
});

test('an admin registers a student; a generated password is 8 characters', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const username = randomUsername('2026');

    const created = await call('POST', '/api/admin/users', {
        role: 'student',
        name: 'Budi',
        username,
    });

    assert.equal(created.statusCode, 201);
    assert.match(created.json().generatedPassword, /^[a-z2-9]{8}$/);
    assert.equal(
        (await login(app, username, created.json().generatedPassword)).json()
            .role,
        'student',
    );
});

test('a chosen password follows the role: 15 characters for a teacher, 8 for a student', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);

    const shortTeacher = await call('POST', '/api/admin/users', {
        role: 'teacher',
        name: 'Pak Andi',
        username: randomUsername('guru'),
        password: 'only 12 char',
    });
    const student = await call('POST', '/api/admin/users', {
        role: 'student',
        name: 'Sari',
        username: randomUsername('2026'),
        password: 'eight ch',
    });

    assert.equal(shortTeacher.statusCode, 400);
    assert.equal(shortTeacher.json().details[0].field, 'password');
    assert.equal(student.statusCode, 201);
    assert.equal(student.json().generatedPassword, null);
});

test('a taken username is refused for a single user', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const existing = await createUser(app);

    const response = await call('POST', '/api/admin/users', {
        role: 'teacher',
        name: 'Bu Sari',
        username: existing.username.toUpperCase(),
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().details[0].field, 'username');
});

test('an admin imports a list; a duplicate or taken username creates nobody and names the rows', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const existing = await createStudent(app);
    const repeated = randomUsername('kembar');
    const fresh = randomUsername('baru');

    const ok = await call('POST', '/api/admin/users/import', {
        role: 'student',
        users: [
            { name: 'Ani', username: randomUsername('2026') },
            {
                name: 'Budi',
                username: randomUsername('2026'),
                password: 'budi password',
            },
        ],
    });

    assert.equal(ok.statusCode, 201);
    assert.equal(ok.json().created.length, 2);
    assert.equal(ok.json().created[1].generatedPassword, null);

    const duplicate = await call('POST', '/api/admin/users/import', {
        role: 'student',
        users: [
            { name: 'A', username: repeated },
            { name: 'B', username: repeated },
        ],
    });

    assert.equal(duplicate.statusCode, 400);
    assert.equal(duplicate.json().details[0].field, 'users/1/username');

    const taken = await call('POST', '/api/admin/users/import', {
        role: 'student',
        users: [
            { name: 'C', username: fresh },
            { name: 'D', username: existing.username },
        ],
    });

    assert.equal(taken.statusCode, 409);
    assert.deepEqual(taken.json().details, [
        { field: 'users/1/username', message: 'Username is already taken' },
    ]);

    const list = await call('GET', '/api/admin/users?role=student');

    assert.ok(
        !list
            .json()
            .some((entry: { username: string }) => entry.username === fresh),
    );
});

test('an admin imports students from an Excel file, numeric usernames included', async (t) => {
    const app = await testApp(t);
    const admin = await createUser(app, 'admin');
    const token = await loginAs(app, admin.username);

    await app.db
        .delete(users)
        .where(inArray(users.username, ['2026.ani', '2026.budi', '202603']));

    const response = await app.inject({
        method: 'POST',
        url: '/api/admin/users/import-file?role=student',
        headers: { ...write, 'content-type': XLSX },
        cookies: { session: token },
        payload: fixture('students.xlsx'),
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(
        response
            .json()
            .created.map(
                (entry: {
                    name: string;
                    username: string;
                    generatedPassword: string | null;
                }) => [
                    entry.name,
                    entry.username,
                    entry.generatedPassword === null,
                ],
            ),
        [
            ['Ani Lestari', '2026.ani', false],
            ['Budi Santoso', '2026.budi', true],
            ['Cici', '202603', false],
        ],
    );
    assert.equal(
        (await login(app, '2026.budi', 'budi password')).statusCode,
        200,
    );
});

test('a file without the needed columns, or not a spreadsheet at all, is refused with a file error', async (t) => {
    const app = await testApp(t);
    const admin = await createUser(app, 'admin');
    const token = await loginAs(app, admin.username);
    const upload = (payload: Buffer, contentType = XLSX) =>
        app.inject({
            method: 'POST',
            url: '/api/admin/users/import-file?role=student',
            headers: { ...write, 'content-type': contentType },
            cookies: { session: token },
            payload,
        });

    const noHeader = await upload(fixture('no-header.xlsx'));
    const garbage = await upload(Buffer.from('this is not a zip file'));

    assert.equal(noHeader.statusCode, 400);
    assert.equal(noHeader.json().details[0].field, 'file');
    assert.equal(garbage.statusCode, 400);
    assert.equal(garbage.json().details[0].field, 'file');
});

test('an admin lists users by role, students with their class', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const teacher = await createUser(app);
    const student = await createStudent(app);

    const teachersList = await call('GET', '/api/admin/users?role=teacher');
    const studentsList = await call('GET', '/api/admin/users?role=student');

    assert.ok(
        teachersList
            .json()
            .some((entry: { id: number }) => entry.id === teacher.id),
    );
    assert.ok(
        !teachersList
            .json()
            .some((entry: { id: number }) => entry.id === student.id),
    );
    assert.equal(
        studentsList
            .json()
            .find((entry: { id: number }) => entry.id === student.id).classroom,
        null,
    );
});

test('students who share a name keep their list order after a class move', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const teacher = await createUser(app);
    const grade4 = await createClass(app, await loginAs(app, teacher.username));
    const name = randomUsername('Sama');
    const first = await createStudent(app, name);
    const second = await createStudent(app, name);

    await call('PUT', `/api/admin/students/${first.id}/class`, {
        classId: grade4.id,
    });
    const list = await call('GET', '/api/admin/users?role=student');

    assert.deepEqual(
        list
            .json()
            .filter((entry: { name: string }) => entry.name === name)
            .map((entry: { id: number }) => entry.id),
        [first.id, second.id],
    );
});

test('an admin moves a student to another class or takes them out of any class', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const teacher = await createUser(app);
    const teacherToken = await loginAs(app, teacher.username);
    const grade4 = await createClass(app, teacherToken);
    const grade5 = await createClass(app, teacherToken);
    const student = await createStudent(app);

    const into4 = await call('PUT', `/api/admin/students/${student.id}/class`, {
        classId: grade4.id,
    });
    const into5 = await call('PUT', `/api/admin/students/${student.id}/class`, {
        classId: grade5.id,
    });

    assert.equal(into4.json().classroom.id, grade4.id);
    assert.equal(into5.json().classroom.id, grade5.id);

    const out = await call('PUT', `/api/admin/students/${student.id}/class`, {
        classId: null,
    });

    assert.deepEqual(out.json(), { classroom: null });
    assert.equal(
        (
            await call('PUT', `/api/admin/students/${student.id}/class`, {
                classId: 2_000_000_000,
            })
        ).statusCode,
        404,
    );
    assert.equal(
        (
            await call('PUT', `/api/admin/students/${teacher.id}/class`, {
                classId: grade4.id,
            })
        ).statusCode,
        404,
    );
});

test('an admin resets a teacher or student password; old passwords and sessions stop working', async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const teacher = await createUser(app);
    const student = await createStudent(app);
    const cases = [
        { account: teacher, oldPassword: TEST_PASSWORD, length: 16 },
        { account: student, oldPassword: TEST_STUDENT_PASSWORD, length: 8 },
    ];

    for (const { account, oldPassword, length } of cases) {
        const oldSession = await loginAs(app, account.username, oldPassword);
        const reset = await call(
            'POST',
            `/api/admin/users/${account.id}/password`,
        );

        assert.equal(reset.statusCode, 200);
        assert.equal(reset.json().password.length, length);

        const me = await app.inject({
            method: 'GET',
            url: '/api/auth/me',
            cookies: { session: oldSession },
        });

        assert.equal(me.statusCode, 401);
        assert.equal(
            (await login(app, account.username, oldPassword)).statusCode,
            401,
        );
        assert.equal(
            (await login(app, account.username, reset.json().password))
                .statusCode,
            200,
        );
    }
});

test("an admin cannot reset another admin's password through the app", async (t) => {
    const app = await testApp(t);
    const call = await adminCaller(app);
    const other = await createUser(app, 'admin');

    assert.equal(
        (await call('POST', `/api/admin/users/${other.id}/password`))
            .statusCode,
        404,
    );
});

test('a teacher or a student cannot use the admin routes', async (t) => {
    const app = await testApp(t);
    const teacher = await createUser(app);
    const student = await createStudent(app);
    const tokens = [
        await loginAs(app, teacher.username),
        await loginAs(app, student.username, TEST_STUDENT_PASSWORD),
    ];

    for (const token of tokens) {
        const response = await app.inject({
            method: 'POST',
            url: '/api/admin/users',
            headers: write,
            cookies: { session: token },
            payload: { role: 'teacher', name: 'X', username: randomUsername() },
        });

        assert.equal(response.statusCode, 403);
    }
});

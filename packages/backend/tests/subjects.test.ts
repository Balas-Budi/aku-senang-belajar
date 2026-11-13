import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
    createStudent,
    createUser,
    loginAs,
    randomUsername,
    TEST_ORIGIN,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';
import { pdfOf } from './pdf.ts';

function send(
    app: FastifyInstance,
    token: string,
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    payload?: object,
) {
    return app.inject({
        method,
        url,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload,
    });
}

async function signIn(app: FastifyInstance, role: 'teacher' | 'admin') {
    const user = await createUser(app, role);
    return loginAs(app, user.username);
}

function upload(app: FastifyInstance, token: string, subject: string) {
    const params = new URLSearchParams({
        title: 'Buku seni',
        subject,
        grade: '4',
        rights: '1',
    });
    return app.inject({
        method: 'POST',
        url: `/api/materials?${params}`,
        headers: { origin: TEST_ORIGIN, 'content-type': 'application/pdf' },
        cookies: { session: token },
        payload: pdfOf(['Menggambar garis lurus.']),
    });
}

test('every role reads the subjects, built-in four first', async (t) => {
    const app = await testApp(t);
    const student = await createStudent(app);
    const token = await loginAs(app, student.username, TEST_STUDENT_PASSWORD);

    const response = await send(app, token, 'GET', '/api/subjects');

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
        response
            .json()
            .slice(0, 4)
            .map(({ key, builtIn }: { key: string; builtIn: boolean }) => [
                key,
                builtIn,
            ]),
        [
            ['mathematics', true],
            ['natural_and_social_science', true],
            ['indonesian_language', true],
            ['pancasila_education', true],
        ],
    );
});

test('a teacher adds a subject and uploads a book under it; the same name is refused', async (t) => {
    const app = await testApp(t);
    const teacher = await signIn(app, 'teacher');
    const name = randomUsername('Seni Budaya');

    const created = await send(app, teacher, 'POST', '/api/subjects', {
        name,
        color: 'purple',
        icon: 'brush',
    });

    assert.equal(created.statusCode, 201);
    assert.equal(created.json().name, name);
    assert.equal(created.json().builtIn, false);
    assert.match(created.json().key, /^seni-budaya/);

    const again = await send(app, teacher, 'POST', '/api/subjects', {
        name: name.toUpperCase(),
        color: 'pink',
        icon: 'book',
    });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().name, 'SUBJECT_EXISTS');

    const book = await upload(app, teacher, created.json().key);
    assert.equal(book.statusCode, 201);
    assert.equal(book.json().subject, created.json().key);

    const unknown = await upload(app, teacher, 'no-such-subject');
    assert.equal(unknown.statusCode, 400);
    assert.equal(unknown.json().details[0].field, 'subject');
});

test('only an admin removes a subject, and not while a book uses it', async (t) => {
    const app = await testApp(t);
    const teacher = await signIn(app, 'teacher');
    const admin = await signIn(app, 'admin');
    const used = (
        await send(app, admin, 'POST', '/api/subjects', {
            name: randomUsername('Musik'),
            color: 'blue',
            icon: 'music',
        })
    ).json();
    const unused = (
        await send(app, teacher, 'POST', '/api/subjects', {
            name: randomUsername('Olahraga'),
            color: 'green',
            icon: 'ball',
        })
    ).json();
    await upload(app, teacher, used.key);

    assert.equal(
        (await send(app, teacher, 'DELETE', `/api/subjects/${unused.key}`))
            .statusCode,
        403,
    );

    const refused = await send(
        app,
        admin,
        'DELETE',
        `/api/subjects/${used.key}`,
    );
    assert.equal(refused.statusCode, 409);
    assert.equal(refused.json().name, 'SUBJECT_IN_USE');
    assert.equal(refused.json().details.books, 1);

    const listed = (await send(app, admin, 'GET', '/api/subjects'))
        .json()
        .find(({ key }: { key: string }) => key === used.key);
    assert.equal(listed.books, 1);

    assert.equal(
        (await send(app, admin, 'DELETE', `/api/subjects/${unused.key}`))
            .statusCode,
        204,
    );
    assert.equal(
        (await send(app, admin, 'DELETE', `/api/subjects/${unused.key}`))
            .statusCode,
        404,
    );
});

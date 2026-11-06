import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { studentProfiles } from '../src/db/schema.ts';
import {
    createStudent,
    createUser,
    loginAs,
    TEST_ORIGIN,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';

async function signedInStudent(app: FastifyInstance) {
    const student = await createStudent(app);

    return loginAs(app, student.username, TEST_STUDENT_PASSWORD);
}

function readProfile(app: FastifyInstance, token: string) {
    return app.inject({
        method: 'GET',
        url: '/api/student/profile',
        cookies: { session: token },
    });
}

function saveProfile(app: FastifyInstance, token: string, payload: object) {
    return app.inject({
        method: 'PUT',
        url: '/api/student/profile',
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload,
    });
}

test('a student has no profile until they save or skip the introduction (FR-003)', async (t) => {
    const app = await testApp(t);
    const token = await signedInStudent(app);

    const response = await readProfile(app, token);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { profile: null });
});

test('a student saves interests in the fixed order and changes them later (FR-003)', async (t) => {
    const app = await testApp(t);
    const token = await signedInStudent(app);

    const saved = await saveProfile(app, token, {
        interests: ['space', 'animals'],
    });

    assert.equal(saved.statusCode, 200);
    assert.deepEqual(saved.json().profile.interests, ['animals', 'space']);
    assert.ok(Date.parse(saved.json().profile.updatedAt));
    assert.deepEqual((await readProfile(app, token)).json().profile.interests, [
        'animals',
        'space',
    ]);

    const changed = await saveProfile(app, token, { interests: ['music'] });

    assert.equal(changed.statusCode, 200);
    assert.deepEqual((await readProfile(app, token)).json().profile.interests, [
        'music',
    ]);
});

test('skipping stores a profile without interests, so it is not asked again (FR-003)', async (t) => {
    const app = await testApp(t);
    const token = await signedInStudent(app);

    const skipped = await saveProfile(app, token, { interests: [] });

    assert.equal(skipped.statusCode, 200);
    assert.deepEqual(skipped.json().profile.interests, []);
    assert.deepEqual(
        (await readProfile(app, token)).json().profile.interests,
        [],
    );
});

test('an interest dropped from the list is left out when a profile is read', async (t) => {
    const app = await testApp(t);
    const student = await createStudent(app);
    const token = await loginAs(app, student.username, TEST_STUDENT_PASSWORD);

    await app.db
        .insert(studentProfiles)
        .values({ studentId: student.id, interests: ['dinosaurs', 'nature'] });

    const response = await readProfile(app, token);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().profile.interests, ['nature']);
});

test('a student reads only their own profile', async (t) => {
    const app = await testApp(t);
    const first = await signedInStudent(app);
    const second = await signedInStudent(app);

    await saveProfile(app, first, { interests: ['football'] });

    assert.deepEqual((await readProfile(app, second)).json(), {
        profile: null,
    });
});

test('an unknown or repeated interest is refused with its field', async (t) => {
    const app = await testApp(t);
    const token = await signedInStudent(app);

    const unknown = await saveProfile(app, token, {
        interests: ['nature', 'dragons'],
    });

    assert.equal(unknown.statusCode, 400);
    assert.equal(unknown.json().name, 'VALIDATION_ERROR');
    assert.equal(unknown.json().details[0].field, 'interests/1');

    const repeated = await saveProfile(app, token, {
        interests: ['cooking', 'cooking'],
    });

    assert.equal(repeated.statusCode, 400);
    assert.equal(repeated.json().name, 'VALIDATION_ERROR');
    assert.equal(repeated.json().details[0].field, 'interests');

    const missing = await saveProfile(app, token, {});

    assert.equal(missing.statusCode, 400);
    assert.equal(missing.json().details[0].field, 'interests');
    assert.deepEqual((await readProfile(app, token)).json(), {
        profile: null,
    });
});

test('only a signed-in student reaches a profile', async (t) => {
    const app = await testApp(t);
    const anonymous = await app.inject({
        method: 'GET',
        url: '/api/student/profile',
    });

    assert.equal(anonymous.statusCode, 401);
    assert.equal(anonymous.json().name, 'UNAUTHORIZED');

    for (const role of ['teacher', 'admin'] as const) {
        const user = await createUser(app, role);
        const token = await loginAs(app, user.username);

        const read = await readProfile(app, token);
        const write = await saveProfile(app, token, { interests: [] });

        assert.equal(read.statusCode, 403);
        assert.equal(read.json().name, 'FORBIDDEN');
        assert.equal(write.statusCode, 403);
    }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
    assignments,
    classMembers,
    learningSessions,
    materials,
    modules,
    sessionBlocks,
} from '../src/db/schema.ts';
import {
    createClass,
    createStudent,
    createUser,
    loginAs,
    TEST_ORIGIN,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';

type Subject = typeof materials.$inferInsert.subject;

async function book(app: FastifyInstance, subject: Subject = 'mathematics') {
    const [material] = await app.db
        .insert(materials)
        .values({ subject, title: `Book of ${subject}` })
        .returning({ id: materials.id });

    return material.id;
}

async function chapter(
    app: FastifyInstance,
    materialId: number,
    title: string,
    firstPage: number | null = null,
) {
    const [row] = await app.db
        .insert(modules)
        .values({ materialId, title, firstPage, lastPage: firstPage })
        .returning({ id: modules.id });

    return row.id;
}

async function stage(
    app: FastifyInstance,
    moduleId: number,
    title: string,
    status: 'draft' | 'ready' = 'ready',
) {
    const [session] = await app.db
        .insert(learningSessions)
        .values({ moduleId, title, summary: `About ${title}`, status })
        .returning({ id: learningSessions.id });

    await app.db.insert(sessionBlocks).values({
        learningSessionId: session.id,
        position: 1,
        kind: 'story',
        content: { text: `${title} in one sentence.` },
    });

    return session.id;
}

async function assign(
    app: FastifyInstance,
    classId: number,
    sessionIds: number[],
    assignedAt = new Date(),
) {
    const rows = await app.db
        .insert(assignments)
        .values(
            sessionIds.map((learningSessionId) => ({
                learningSessionId,
                classId,
                assignedAt,
            })),
        )
        .returning({ id: assignments.id });

    return rows.map(({ id }) => id);
}

async function studentInClass(app: FastifyInstance) {
    const teacher = await createUser(app);
    const classroom = await createClass(
        app,
        await loginAs(app, teacher.username),
    );
    const student = await createStudent(app);

    await app.db
        .insert(classMembers)
        .values({ studentId: student.id, classId: classroom.id });

    return {
        classId: classroom.id,
        token: await loginAs(app, student.username, TEST_STUDENT_PASSWORD),
    };
}

function call(
    app: FastifyInstance,
    token: string,
    method: 'GET' | 'POST',
    url: string,
) {
    return app.inject({
        method,
        url: `/api/student${url}`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
    });
}

const fresh = { progress: 'not_started', step: null };

test('the path lists chapters in book order with stages in order, later stages locked, and the unopened chapters of the same book (FR-016)', async (t) => {
    const app = await testApp(t);
    const { classId, token } = await studentInClass(app);
    const maths = await book(app);
    const late = await chapter(app, maths, 'Decimals', 30);
    const early = await chapter(app, maths, 'Fractions', 10);
    const unpaged = await chapter(app, maths, 'Shapes');
    const science = await book(app, 'natural_and_social_science');
    const plants = await chapter(app, science, 'Plants', 5);
    const [halves, quarters, compare] = await assign(
        app,
        classId,
        [
            await stage(app, early, 'Halves'),
            await stage(app, early, 'Quarters'),
            await stage(app, early, 'Compare'),
        ],
        new Date('2026-11-02T01:00:00.000Z'),
    );
    const [roots] = await assign(
        app,
        classId,
        [await stage(app, plants, 'Roots')],
        new Date('2026-11-03T01:00:00.000Z'),
    );

    const response = await call(app, token, 'GET', '/path');

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
        subjects: [
            {
                subject: 'mathematics',
                chapters: [
                    {
                        id: early,
                        title: 'Fractions',
                        book: 'Book of mathematics',
                        open: true,
                        stages: [
                            {
                                id: halves,
                                title: 'Halves',
                                summary: 'About Halves',
                                ...fresh,
                                locked: false,
                            },
                            {
                                id: quarters,
                                title: 'Quarters',
                                summary: 'About Quarters',
                                ...fresh,
                                locked: true,
                            },
                            {
                                id: compare,
                                title: 'Compare',
                                summary: 'About Compare',
                                ...fresh,
                                locked: true,
                            },
                        ],
                    },
                    {
                        id: late,
                        title: 'Decimals',
                        book: 'Book of mathematics',
                        open: false,
                        stages: [],
                    },
                    {
                        id: unpaged,
                        title: 'Shapes',
                        book: 'Book of mathematics',
                        open: false,
                        stages: [],
                    },
                ],
            },
            {
                subject: 'natural_and_social_science',
                chapters: [
                    {
                        id: plants,
                        title: 'Plants',
                        book: 'Book of natural_and_social_science',
                        open: true,
                        stages: [
                            {
                                id: roots,
                                title: 'Roots',
                                summary: 'About Roots',
                                ...fresh,
                                locked: false,
                            },
                        ],
                    },
                ],
            },
        ],
    });
});

test('a locked stage opens only after the stage before it is submitted', async (t) => {
    const app = await testApp(t);
    const { classId, token } = await studentInClass(app);
    const fractions = await chapter(app, await book(app), 'Fractions', 1);
    const [first, second] = await assign(app, classId, [
        await stage(app, fractions, 'Halves'),
        await stage(app, fractions, 'Quarters'),
    ]);

    const lockedDetail = await call(
        app,
        token,
        'GET',
        `/assignments/${second}`,
    );
    const lockedStart = await call(
        app,
        token,
        'POST',
        `/assignments/${second}/attempt`,
    );
    const attempt: { id: number } = (
        await call(app, token, 'POST', `/assignments/${first}/attempt`)
    ).json();
    const whileFirstRuns = await call(
        app,
        token,
        'POST',
        `/assignments/${second}/attempt`,
    );

    await call(app, token, 'POST', `/attempts/${attempt.id}/submit`);

    const opened = await call(app, token, 'GET', `/assignments/${second}`);
    const started = await call(
        app,
        token,
        'POST',
        `/assignments/${second}/attempt`,
    );

    assert.equal(lockedDetail.statusCode, 409);
    assert.equal(lockedDetail.json().name, 'STAGE_LOCKED');
    assert.equal(lockedStart.statusCode, 409);
    assert.equal(lockedStart.json().name, 'STAGE_LOCKED');
    assert.equal(whileFirstRuns.statusCode, 409);
    assert.equal(opened.statusCode, 200);
    assert.equal(opened.json().moduleId, fractions);
    assert.equal(started.statusCode, 201);
});

test('a student sees neither draft sessions nor those of another class (AT-03)', async (t) => {
    const app = await testApp(t);
    const { classId, token } = await studentInClass(app);
    const other = await studentInClass(app);
    const fractions = await chapter(app, await book(app), 'Fractions', 1);
    const [ready] = await assign(app, classId, [
        await stage(app, fractions, 'Ready'),
    ]);

    await assign(app, classId, [await stage(app, fractions, 'Draft', 'draft')]);
    await assign(app, other.classId, [
        await stage(app, fractions, 'Other class'),
    ]);

    const response = await call(app, token, 'GET', '/path');
    const [subject] = response.json().subjects;

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
        subject.chapters[0].stages.map((entry: { id: number }) => entry.id),
        [ready],
    );
});

test('a student without a class has an empty path', async (t) => {
    const app = await testApp(t);
    const student = await createStudent(app);

    const response = await call(
        app,
        await loginAs(app, student.username, TEST_STUDENT_PASSWORD),
        'GET',
        '/path',
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { subjects: [] });
});

test('only a signed-in student reads the path', async (t) => {
    const app = await testApp(t);
    const teacher = await createUser(app);

    const anonymous = await app.inject({
        method: 'GET',
        url: '/api/student/path',
    });
    const asTeacher = await call(
        app,
        await loginAs(app, teacher.username),
        'GET',
        '/path',
    );

    assert.equal(anonymous.statusCode, 401);
    assert.equal(anonymous.json().name, 'UNAUTHORIZED');
    assert.equal(asTeacher.statusCode, 403);
    assert.equal(asTeacher.json().name, 'FORBIDDEN');
});

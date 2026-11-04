import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
    assignments,
    classMembers,
    learningSessions,
    materials,
    modules,
} from '../src/db/schema.ts';
import {
    createClass,
    createStudent,
    createUser,
    loginAs,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';

type Sample = {
    title: string;
    subject?: typeof materials.$inferInsert.subject;
    status?: typeof learningSessions.$inferInsert.status;
    assignedAt?: Date;
};

async function assignSession(
    app: FastifyInstance,
    classId: number,
    {
        title,
        subject = 'mathematics',
        status = 'ready',
        assignedAt = new Date(),
    }: Sample,
) {
    const [material] = await app.db
        .insert(materials)
        .values({ subject, title: 'Grade 5 book' })
        .returning({ id: materials.id });
    const [chapter] = await app.db
        .insert(modules)
        .values({ materialId: material.id, title: `Chapter of ${title}` })
        .returning({ id: modules.id });
    const [session] = await app.db
        .insert(learningSessions)
        .values({
            moduleId: chapter.id,
            title,
            summary: `What ${title} covers`,
            status,
        })
        .returning({ id: learningSessions.id });
    const [assignment] = await app.db
        .insert(assignments)
        .values({ learningSessionId: session.id, classId, assignedAt })
        .returning({ id: assignments.id });

    return assignment.id;
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

function myAssignments(app: FastifyInstance, token: string) {
    return app.inject({
        method: 'GET',
        url: '/api/student/assignments',
        cookies: { session: token },
    });
}

test('a student sees the sessions assigned to their class, newest first (FR-016)', async (t) => {
    const app = await testApp(t);
    const { classId, token } = await studentInClass(app);
    const monday = new Date('2026-11-02T01:00:00.000Z');
    const tuesday = new Date('2026-11-03T01:00:00.000Z');
    const fractions = await assignSession(app, classId, {
        title: 'Fractions',
        assignedAt: monday,
    });
    const foodChains = await assignSession(app, classId, {
        title: 'Food chains',
        subject: 'natural_and_social_science',
        assignedAt: tuesday,
    });
    const mainIdea = await assignSession(app, classId, {
        title: 'Main idea',
        subject: 'indonesian_language',
        assignedAt: tuesday,
    });

    const response = await myAssignments(app, token);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), [
        {
            id: foodChains,
            title: 'Food chains',
            summary: 'What Food chains covers',
            subject: 'natural_and_social_science',
            moduleTitle: 'Chapter of Food chains',
            progress: 'not_started',
            step: null,
        },
        {
            id: mainIdea,
            title: 'Main idea',
            summary: 'What Main idea covers',
            subject: 'indonesian_language',
            moduleTitle: 'Chapter of Main idea',
            progress: 'not_started',
            step: null,
        },
        {
            id: fractions,
            title: 'Fractions',
            summary: 'What Fractions covers',
            subject: 'mathematics',
            moduleTitle: 'Chapter of Fractions',
            progress: 'not_started',
            step: null,
        },
    ]);
});

test('a student sees neither draft sessions nor those of another class (AT-03)', async (t) => {
    const app = await testApp(t);
    const { classId, token } = await studentInClass(app);
    const other = await studentInClass(app);
    const ready = await assignSession(app, classId, { title: 'Ready' });

    await assignSession(app, classId, { title: 'Draft', status: 'draft' });
    await assignSession(app, other.classId, { title: 'Other class' });

    const response = await myAssignments(app, token);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
        response.json().map((entry: { id: number }) => entry.id),
        [ready],
    );
});

test('a student without a class has no assigned sessions', async (t) => {
    const app = await testApp(t);
    const student = await createStudent(app);

    const response = await myAssignments(
        app,
        await loginAs(app, student.username, TEST_STUDENT_PASSWORD),
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), []);
});

test('only a signed-in student reads assigned sessions', async (t) => {
    const app = await testApp(t);
    const teacher = await createUser(app);

    const anonymous = await app.inject({
        method: 'GET',
        url: '/api/student/assignments',
    });
    const asTeacher = await myAssignments(
        app,
        await loginAs(app, teacher.username),
    );

    assert.equal(anonymous.statusCode, 401);
    assert.equal(anonymous.json().name, 'UNAUTHORIZED');
    assert.equal(asTeacher.statusCode, 403);
    assert.equal(asTeacher.json().name, 'FORBIDDEN');
});

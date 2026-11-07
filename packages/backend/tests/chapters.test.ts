import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
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

async function teacher(app: FastifyInstance) {
    const user = await createUser(app);
    const token = await loginAs(app, user.username);
    const classroom = await createClass(app, token);

    return { id: user.id, token, classId: classroom.id };
}

async function chapterIn(app: FastifyInstance, ownerId: number | null = null) {
    const [material] = await app.db
        .insert(materials)
        .values({ subject: 'mathematics', title: 'Maths 5', ownerId })
        .returning({ id: materials.id });
    const [row] = await app.db
        .insert(modules)
        .values({ materialId: material.id, title: 'Fractions', firstPage: 1 })
        .returning({ id: modules.id });

    return { materialId: material.id, moduleId: row.id };
}

async function stage(
    app: FastifyInstance,
    moduleId: number,
    title: string,
    { createdBy = null, status = 'ready' } = {} as {
        createdBy?: number | null;
        status?: 'draft' | 'ready';
    },
) {
    const [session] = await app.db
        .insert(learningSessions)
        .values({ moduleId, title, summary: title, status, createdBy })
        .returning({ id: learningSessions.id });

    await app.db.insert(sessionBlocks).values({
        learningSessionId: session.id,
        position: 1,
        kind: 'story',
        content: { text: `${title}.` },
    });

    return session.id;
}

function send(
    app: FastifyInstance,
    token: string,
    method: 'GET' | 'PUT' | 'DELETE' | 'POST',
    url: string,
) {
    return app.inject({
        method,
        url,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
    });
}

const chapterUrl = (classId: number, moduleId: number) =>
    `/api/classes/${classId}/chapters/${moduleId}`;

async function studentIn(app: FastifyInstance, classId: number) {
    const student = await createStudent(app);

    await app.db
        .insert(classMembers)
        .values({ studentId: student.id, classId });

    return loginAs(app, student.username, TEST_STUDENT_PASSWORD);
}

async function stageTitles(app: FastifyInstance, token: string) {
    const path: {
        subjects: { chapters: { stages: { id: number; title: string }[] }[] }[];
    } = (await send(app, token, 'GET', '/api/student/path')).json();

    return path.subjects
        .flatMap(({ chapters }) => chapters)
        .flatMap(({ stages }) => stages);
}

test('opening a chapter gives the class every ready stage the teacher can use, once', async (t) => {
    const app = await testApp(t);
    const owner = await teacher(app);
    const colleague = await teacher(app);
    const { materialId, moduleId } = await chapterIn(app);

    await stage(app, moduleId, 'Prepared');
    await stage(app, moduleId, 'Mine', { createdBy: owner.id });
    await stage(app, moduleId, 'Colleague', { createdBy: colleague.id });
    await stage(app, moduleId, 'Draft', { status: 'draft' });

    const chapters = () =>
        send(app, owner.token, 'GET', `/api/classes/${owner.classId}/chapters`);
    const before = await chapters();
    const first = await send(
        app,
        owner.token,
        'PUT',
        chapterUrl(owner.classId, moduleId),
    );
    const again = await send(
        app,
        owner.token,
        'PUT',
        chapterUrl(owner.classId, moduleId),
    );
    const after = await chapters();
    const student = await studentIn(app, owner.classId);

    assert.equal(before.statusCode, 200);
    assert.deepEqual(
        before.json().find((entry: { id: number }) => entry.id === materialId),
        {
            id: materialId,
            title: 'Maths 5',
            subject: 'mathematics',
            prepared: true,
            chapters: [
                {
                    id: moduleId,
                    title: 'Fractions',
                    openStages: 0,
                    waitingStages: 2,
                    started: false,
                },
            ],
        },
    );
    assert.equal(first.statusCode, 204);
    assert.equal(again.statusCode, 204);
    assert.deepEqual(
        after.json().find((entry: { id: number }) => entry.id === materialId)
            .chapters[0],
        {
            id: moduleId,
            title: 'Fractions',
            openStages: 2,
            waitingStages: 0,
            started: false,
        },
    );
    assert.deepEqual(
        (await stageTitles(app, student)).map(({ title }) => title),
        ['Prepared', 'Mine'],
    );
});

test('a teacher opens only chapters with a ready stage, in their own class, from a book they can see', async (t) => {
    const app = await testApp(t);
    const owner = await teacher(app);
    const colleague = await teacher(app);
    const prepared = await chapterIn(app);
    const theirs = await chapterIn(app, colleague.id);
    const empty = await chapterIn(app);

    await stage(app, prepared.moduleId, 'Prepared');
    await stage(app, theirs.moduleId, 'Theirs', { createdBy: colleague.id });
    await stage(app, empty.moduleId, 'Draft only', { status: 'draft' });

    const otherClass = await send(
        app,
        owner.token,
        'PUT',
        chapterUrl(colleague.classId, prepared.moduleId),
    );
    const hiddenBook = await send(
        app,
        owner.token,
        'PUT',
        chapterUrl(owner.classId, theirs.moduleId),
    );
    const nothingReady = await send(
        app,
        owner.token,
        'PUT',
        chapterUrl(owner.classId, empty.moduleId),
    );
    const listed = await send(
        app,
        owner.token,
        'GET',
        `/api/classes/${owner.classId}/chapters`,
    );
    const asStudent = await send(
        app,
        await studentIn(app, owner.classId),
        'PUT',
        chapterUrl(owner.classId, prepared.moduleId),
    );

    assert.equal(otherClass.statusCode, 404);
    assert.equal(hiddenBook.statusCode, 404);
    assert.equal(nothingReady.statusCode, 409);
    assert.equal(nothingReady.json().name, 'CHAPTER_EMPTY');
    assert.ok(
        !listed
            .json()
            .some((entry: { id: number }) => entry.id === theirs.materialId),
    );
    assert.equal(asStudent.statusCode, 403);
});

test('closing a chapter works only until a student starts one of its stages', async (t) => {
    const app = await testApp(t);
    const owner = await teacher(app);
    const { moduleId } = await chapterIn(app);

    await stage(app, moduleId, 'Halves');

    const url = chapterUrl(owner.classId, moduleId);
    const student = await studentIn(app, owner.classId);

    await send(app, owner.token, 'PUT', url);
    const closed = await send(app, owner.token, 'DELETE', url);
    const afterClose = await stageTitles(app, student);

    await send(app, owner.token, 'PUT', url);
    const [halves] = await stageTitles(app, student);
    await send(
        app,
        student,
        'POST',
        `/api/student/assignments/${halves.id}/attempt`,
    );
    const refused = await send(app, owner.token, 'DELETE', url);
    const kept = await app.db
        .select({ id: assignments.id })
        .from(assignments)
        .where(eq(assignments.classId, owner.classId));

    assert.equal(closed.statusCode, 204);
    assert.deepEqual(afterClose, []);
    assert.equal(refused.statusCode, 409);
    assert.equal(refused.json().name, 'CHAPTER_STARTED');
    assert.equal(kept.length, 1);
});

test('the material page lists only the stages the teacher can use', async (t) => {
    const app = await testApp(t);
    const owner = await teacher(app);
    const colleague = await teacher(app);
    const { materialId, moduleId } = await chapterIn(app);

    await stage(app, moduleId, 'Prepared');
    await stage(app, moduleId, 'Mine', { createdBy: owner.id });
    await stage(app, moduleId, 'Colleague', { createdBy: colleague.id });

    const response = await send(
        app,
        owner.token,
        'GET',
        `/api/materials/${materialId}`,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
        response
            .json()
            .modules[0].sessions.map(({ title }: { title: string }) => title),
        ['Prepared', 'Mine'],
    );
});

test('a chapter address that is not a positive number answers 400', async (t) => {
    const app = await testApp(t);
    const owner = await teacher(app);
    const cases = [
        ['GET', '/api/classes/abc/chapters', 'classId'],
        ['PUT', `/api/classes/${owner.classId}/chapters/abc`, 'moduleId'],
        ['DELETE', `/api/classes/${owner.classId}/chapters/0`, 'moduleId'],
        ['PUT', '/api/classes/0/chapters/1', 'classId'],
    ] as const;

    for (const [method, url, field] of cases) {
        const response = await send(app, owner.token, method, url);

        assert.equal(response.statusCode, 400, `${method} ${url}`);
        assert.equal(response.json().name, 'VALIDATION_ERROR');
        assert.equal(response.json().details[0].field, field);
    }
});

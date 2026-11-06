import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    assignments,
    blockCompetencies,
    competencies,
    learningSessions,
} from '../src/db/schema.ts';
import { completion, stubProvider } from './ai-stub.ts';
import { demoClass, demoStudent } from './demo-attempts.ts';
import { createClass, testApp } from './helpers.ts';
import {
    draft,
    draftedSession,
    get,
    post,
    put,
    teacherWithModule,
} from './studio-fixtures.ts';

const approval = (id: number) => `/api/studio/sessions/${id}/approval`;
const assigning = (id: number) => `/api/studio/sessions/${id}/assignments`;

async function draftingApp(t: TestContext, replies = [draft]) {
    const provider = await stubProvider(
        t,
        replies.map((reply) => ({ body: completion(JSON.stringify(reply)) })),
    );

    return testApp(t, provider.config);
}

async function titlesFor(app: FastifyInstance, token: string) {
    const list: { title: string }[] = (
        await get(app, token, '/api/student/assignments')
    ).json();

    return list.map(({ title }) => title);
}

test('publishing needs every warning acknowledged, then records who approved it and when (FR-011)', async (t) => {
    const unsourced = {
        ...draft,
        blocks: draft.blocks.map((block, index) =>
            index === 3 ? { ...block, pages: [] } : block,
        ),
    };
    const app = await draftingApp(t, [unsourced]);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);

    const review = (
        await get(app, token, `/api/studio/sessions/${session.id}`)
    ).json();
    assert.deepEqual(review.issues, []);
    assert.deepEqual(review.warnings, [
        { code: 'no_page_source', blocks: [5] },
        { code: 'unreadable_pages', pages: [2] },
    ]);

    const partly = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
    });
    assert.equal(partly.statusCode, 409);
    assert.equal(partly.json().name, 'WARNINGS_NOT_ACKNOWLEDGED');

    const approved = await post(app, token, approval(session.id), {
        acknowledged: ['no_page_source', 'unreadable_pages'],
    });
    assert.equal(approved.statusCode, 200);
    assert.equal(approved.json().status, 'ready');

    const [row] = await app.db
        .select({
            createdBy: learningSessions.createdBy,
            approvedBy: learningSessions.approvedBy,
            approvedAt: learningSessions.approvedAt,
            acknowledgedWarnings: learningSessions.acknowledgedWarnings,
            version: learningSessions.version,
        })
        .from(learningSessions)
        .where(eq(learningSessions.id, session.id));
    assert.equal(row.approvedBy, row.createdBy);
    assert.ok(row.approvedAt instanceof Date);
    assert.deepEqual(row.acknowledgedWarnings, review.warnings);
    assert.equal(row.version, 1);

    const story = session.blocks.find(({ kind }) => kind === 'story');
    assert.ok(story);
    const edit = await put(
        app,
        token,
        `/api/studio/sessions/${session.id}/blocks/${story.id}`,
        { content: story.content },
    );
    assert.equal(edit.statusCode, 409);
    assert.equal(edit.json().name, 'SESSION_PUBLISHED');
    const again = await post(app, token, approval(session.id), {
        acknowledged: ['no_page_source', 'unreadable_pages'],
    });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().name, 'SESSION_PUBLISHED');
});

test('a hard issue blocks publishing, whatever is acknowledged', async (t) => {
    const app = await draftingApp(t);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    const rows = await app.db
        .select({ id: competencies.id, code: competencies.code })
        .from(competencies)
        .where(eq(competencies.moduleId, moduleId));
    const idOf = (code: string) => rows.find((row) => row.code === code)?.id;
    await app.db
        .update(competencies)
        .set({ rubric: null })
        .where(eq(competencies.id, idOf('C2') ?? 0));
    await app.db
        .delete(blockCompetencies)
        .where(eq(blockCompetencies.competencyId, idOf('C1') ?? 0));

    const review = (
        await get(app, token, `/api/studio/sessions/${session.id}`)
    ).json();
    assert.deepEqual(review.issues, [
        { code: 'missing_rubric', competencies: ['C2'] },
        { code: 'untested_competency', competencies: ['C1'] },
    ]);

    const response = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().name, 'PUBLISH_BLOCKED');
    assert.equal(
        (await get(app, token, `/api/studio/sessions/${session.id}`)).json()
            .status,
        'draft',
    );
});

test('a session without a draft cannot be published', async (t) => {
    const broken = { ...draft, blocks: draft.blocks.slice(0, -1) };
    const app = await draftingApp(t, [broken, broken]);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    assert.equal(session.drafting, 'failed');

    const review = (
        await get(app, token, `/api/studio/sessions/${session.id}`)
    ).json();
    assert.deepEqual(review.issues, [{ code: 'no_draft' }]);
    const response = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().name, 'PUBLISH_BLOCKED');
});

test("a ready session goes to the teacher's own classes at once, and a draft never reaches a student (AT-03, FR-015)", async (t) => {
    const app = await draftingApp(t);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    const first = await createClass(app, token);
    const second = await createClass(app, token);
    const ayu = await demoStudent(app, first.id, 'Ayu Lestari');
    const bima = await demoStudent(app, second.id, 'Bima Putra');

    const early = await post(app, token, assigning(session.id), {
        classIds: [first.id],
    });
    assert.equal(early.statusCode, 409);
    assert.equal(early.json().name, 'SESSION_NOT_READY');
    assert.deepEqual(await titlesFor(app, ayu.token), []);

    await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
    });
    const assigned = await post(app, token, assigning(session.id), {
        classIds: [first.id],
    });
    assert.equal(assigned.statusCode, 200);
    assert.deepEqual(assigned.json(), [{ id: first.id, name: 'Kelas 4A' }]);
    assert.deepEqual(await titlesFor(app, ayu.token), ['Kancil berbagi roti']);
    assert.deepEqual(await titlesFor(app, bima.token), []);

    const both = await post(app, token, assigning(session.id), {
        classIds: [first.id, second.id, second.id],
    });
    assert.equal(both.statusCode, 200);
    assert.deepEqual(
        both.json().map(({ id }: { id: number }) => id),
        [first.id, second.id],
    );
    assert.deepEqual(await titlesFor(app, bima.token), ['Kancil berbagi roti']);
    assert.equal(
        (
            await app.db
                .select({ id: assignments.id })
                .from(assignments)
                .where(eq(assignments.learningSessionId, session.id))
        ).length,
        2,
    );
    assert.deepEqual(
        (await get(app, token, `/api/studio/sessions/${session.id}`)).json()
            .assignedClasses,
        [
            { id: first.id, name: 'Kelas 4A' },
            { id: second.id, name: 'Kelas 4A' },
        ],
    );
});

test("the prepared session can be assigned too, and another teacher's class or session answers 404", async (t) => {
    const app = await draftingApp(t);
    const demo = await demoClass(app);
    const [{ sessionId }] = await app.db
        .select({ sessionId: assignments.learningSessionId })
        .from(assignments)
        .where(eq(assignments.id, demo.assignmentId));
    const { token, moduleId } = await teacherWithModule(app);
    const own = await createClass(app, token);
    const citra = await demoStudent(app, own.id, 'Citra Dewi');

    const prepared = await post(app, token, assigning(sessionId), {
        classIds: [own.id],
    });
    assert.equal(prepared.statusCode, 200);
    assert.equal((await titlesFor(app, citra.token)).length, 1);

    const foreignClass = await post(app, token, assigning(sessionId), {
        classIds: [own.id, demo.classId],
    });
    assert.equal(foreignClass.statusCode, 404);

    const session = await draftedSession(app, token, moduleId);
    const other = demo.teacherToken;
    assert.equal(
        (
            await post(app, other, approval(session.id), {
                acknowledged: ['unreadable_pages'],
            })
        ).statusCode,
        404,
    );
    await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
    });
    assert.equal(
        (
            await post(app, other, assigning(session.id), {
                classIds: [demo.classId],
            })
        ).statusCode,
        404,
    );
});

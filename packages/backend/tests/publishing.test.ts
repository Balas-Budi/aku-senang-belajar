import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    assignments,
    blockCompetencies,
    competencies,
    learningSessions,
    sessionBlocks,
} from '../src/db/schema.ts';
import { completion, stubProvider } from './ai-stub.ts';
import { demoClass, demoStudent } from './demo-attempts.ts';
import { createClass, testApp } from './helpers.ts';
import {
    draft,
    draftedSession,
    drawnDraft,
    get,
    post,
    put,
    quarters,
    settled,
    teacherWithModule,
} from './studio-fixtures.ts';

const approval = (id: number) => `/api/studio/sessions/${id}/approval`;
const assigning = (id: number) => `/api/studio/sessions/${id}/assignments`;

async function draftingApp(t: TestContext, replies: object[] = [draft]) {
    const provider = await stubProvider(
        t,
        replies.map((reply) => ({ body: completion(JSON.stringify(reply)) })),
    );

    return testApp(t, provider.config);
}

async function titlesFor(app: FastifyInstance, token: string) {
    const path: {
        subjects: { chapters: { stages: { title: string }[] }[] }[];
    } = (await get(app, token, '/api/student/path')).json();

    return path.subjects
        .flatMap(({ chapters }) => chapters)
        .flatMap(({ stages }) => stages)
        .map(({ title }) => title);
}

type Picture = { diagram?: object };
type Block = {
    id: number;
    position: number;
    content: Record<string, unknown>;
};

function withoutDiagrams(content: Record<string, unknown>) {
    const copy = structuredClone(content) as Picture & {
        hints?: Picture[];
        example?: Picture;
    };
    delete copy.diagram;
    copy.hints?.forEach((hint) => delete hint.diagram);
    delete copy.example?.diagram;

    return copy;
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
        version: session.version,
    });
    assert.equal(partly.statusCode, 409);
    assert.equal(partly.json().name, 'WARNINGS_NOT_ACKNOWLEDGED');

    const approved = await post(app, token, approval(session.id), {
        acknowledged: ['no_page_source', 'unreadable_pages'],
        version: session.version,
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
        version: session.version,
    });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().name, 'SESSION_PUBLISHED');
});

test('of two approvals sent at once, one publishes and the other answers SESSION_PUBLISHED', async (t) => {
    const app = await draftingApp(t);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    const body = {
        acknowledged: ['unreadable_pages'],
        version: session.version,
    };

    const responses = await Promise.all([
        post(app, token, approval(session.id), body),
        post(app, token, approval(session.id), body),
    ]);

    assert.deepEqual(
        responses.map(({ statusCode }) => statusCode).sort(),
        [200, 409],
    );
    const refused = responses.find(({ statusCode }) => statusCode === 409);
    assert.equal(refused?.json().name, 'SESSION_PUBLISHED');
});

test('an approval names the version it was given for', async (t) => {
    const app = await draftingApp(t);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);

    const response = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().name, 'VALIDATION_ERROR');
    assert.equal(response.json().details[0].field, 'version');
});

test('AI diagrams are a warning that names their screens until the last one is removed', async (t) => {
    const app = await draftingApp(t, [drawnDraft]);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);

    const review = (
        await get(app, token, `/api/studio/sessions/${session.id}`)
    ).json();
    const drawn = (review.blocks as Block[])
        .filter(({ content }) => JSON.stringify(content).includes('"diagram"'))
        .map(({ position }) => position);
    assert.equal(drawn.length, 4);
    assert.deepEqual(review.issues, []);
    assert.deepEqual(review.warnings, [
        { code: 'unreadable_pages', pages: [2] },
        { code: 'ai_diagrams', blocks: drawn },
    ]);

    const unseen = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
        version: session.version,
    });
    assert.equal(unseen.statusCode, 409);
    assert.equal(unseen.json().name, 'WARNINGS_NOT_ACKNOWLEDGED');

    const approved = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages', 'ai_diagrams'],
        version: session.version,
    });
    assert.equal(approved.statusCode, 200);
    const [row] = await app.db
        .select({ acknowledged: learningSessions.acknowledgedWarnings })
        .from(learningSessions)
        .where(eq(learningSessions.id, session.id));
    assert.deepEqual(row.acknowledged, review.warnings);
});

test('removing every diagram clears the AI diagrams warning', async (t) => {
    const app = await draftingApp(t, [drawnDraft]);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);

    for (const block of session.blocks) {
        if (!JSON.stringify(block.content).includes('"diagram"')) continue;

        const response = await put(
            app,
            token,
            `/api/studio/sessions/${session.id}/blocks/${block.id}`,
            { content: withoutDiagrams(block.content) },
        );
        assert.equal(response.statusCode, 200);
    }

    const review = (
        await get(app, token, `/api/studio/sessions/${session.id}`)
    ).json();
    assert.deepEqual(review.warnings, [
        { code: 'unreadable_pages', pages: [2] },
    ]);
});

test('an approval given for an older draft answers 409 SESSION_CHANGED and publishes nothing', async (t) => {
    const app = await draftingApp(t, [draft, draft]);
    const { token, moduleId } = await teacherWithModule(app);
    const opened = await draftedSession(app, token, moduleId);

    const revision = await post(
        app,
        token,
        `/api/studio/sessions/${opened.id}/revisions`,
        {},
    );
    assert.equal(revision.statusCode, 202);
    const revised = await settled(app, token, opened.id);
    assert.equal(revised.version, opened.version + 1);

    const stale = await post(app, token, approval(opened.id), {
        acknowledged: ['unreadable_pages'],
        version: opened.version,
    });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().name, 'SESSION_CHANGED');
    assert.equal(
        (await get(app, token, `/api/studio/sessions/${opened.id}`)).json()
            .status,
        'draft',
    );

    const current = await post(app, token, approval(opened.id), {
        acknowledged: ['unreadable_pages'],
        version: revised.version,
    });
    assert.equal(current.statusCode, 200);
});

test('a diagram corrupted after drafting is an invalid block that blocks publishing', async (t) => {
    const app = await draftingApp(t, [drawnDraft]);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    const opened = (
        await get(app, token, `/api/studio/sessions/${session.id}`)
    ).json();
    const story = (opened.blocks as Block[])[2];
    await app.db
        .update(sessionBlocks)
        .set({
            content: {
                ...story.content,
                diagram: {
                    ...quarters,
                    shapes: [
                        { ...quarters.shapes[0], x: 150 },
                        quarters.shapes[1],
                    ],
                },
            },
        })
        .where(eq(sessionBlocks.id, story.id));

    const review = (
        await get(app, token, `/api/studio/sessions/${session.id}`)
    ).json();
    assert.deepEqual(review.issues, [
        { code: 'invalid_block', blocks: [story.position] },
    ]);

    const response = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages', 'ai_diagrams'],
        version: session.version,
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().name, 'PUBLISH_BLOCKED');
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
        version: session.version,
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
        version: session.version,
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
        version: session.version,
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
                version: session.version,
            })
        ).statusCode,
        404,
    );
    await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
        version: session.version,
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

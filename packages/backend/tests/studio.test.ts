import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { learningSessions } from '../src/db/schema.ts';
import { completion, stubProvider } from './ai-stub.ts';
import { createUser, loginAs, TEST_ORIGIN, testApp } from './helpers.ts';
import { get, post, teacherWithModule } from './studio-fixtures.ts';

const choices = [
    { id: 'a', label: 'Roti A' },
    { id: 'b', label: 'Roti B' },
];

function checkFor(code: string, page: number) {
    return {
        kind: 'check',
        content: {
            prompt: 'Roti mana yang dibagi empat sama besar?',
            options: choices,
            answer: 'a',
            praise: 'Tepat sekali!',
            hints: [
                { text: 'Lihat besar setiap potongan.' },
                { text: 'Bandingkan potongan satu dengan yang lain.' },
                { text: 'Potongan perempat semuanya sama besar.' },
            ],
            example: {
                text: 'Kue yang dipotong empat sama besar juga perempat.',
            },
            reveal: 'Roti A, karena keempat potongannya sama besar.',
        },
        competencies: [code],
        pages: [page],
    };
}

const draft = {
    title: 'Kancil berbagi roti',
    summary: 'Belajar membagi roti menjadi empat bagian yang sama besar.',
    blocks: [
        {
            kind: 'hook',
            content: {
                prompt: 'Pernahkah kamu berbagi kue dengan teman?',
                options: [
                    { id: 'a', label: 'Pernah' },
                    { id: 'b', label: 'Belum' },
                ],
            },
            competencies: [],
            pages: [1],
        },
        {
            kind: 'story',
            content: {
                text: 'Kancil punya satu roti. Ia ingin berbagi dengan tiga temannya.',
            },
            competencies: ['C1'],
            pages: [1],
        },
        checkFor('C1', 1),
        {
            kind: 'story',
            content: {
                text: 'Satu dari empat bagian sama besar disebut satu perempat.',
            },
            competencies: ['C2'],
            pages: [3],
        },
        checkFor('C2', 3),
        {
            kind: 'challenge',
            content: {
                prompt: 'Ibu memotong semangka menjadi empat bagian sama besar.',
                question: 'Berapa bagian semangka yang didapat Adi?',
                options: [
                    { id: 'a', label: '1/4' },
                    { id: 'b', label: '1/2' },
                ],
                answer: 'a',
                reasonStarter: 'Menurutku jawabannya',
            },
            competencies: ['C2'],
            pages: [4],
        },
        {
            kind: 'reflection',
            content: {
                topics: ['Pecahan', 'Perempat'],
                takeaways: [
                    'Perempat berarti satu dari empat bagian sama besar.',
                ],
            },
            competencies: [],
            pages: [],
        },
    ],
};

type Session = {
    id: number;
    title: string;
    status: string;
    version: number;
    drafting: string | null;
    draftError: string | null;
    blocks: {
        id: number;
        kind: string;
        content: Record<string, unknown>;
        competencies: string[];
        sourcePages: number[];
    }[];
};

async function settled(
    app: FastifyInstance,
    token: string,
    id: number,
): Promise<Session> {
    for (let tries = 0; tries < 200; tries++) {
        const session = (
            await get(app, token, `/api/studio/sessions/${id}`)
        ).json();

        if (session.drafting !== 'generating') return session;

        await new Promise((done) => setTimeout(done, 25));
    }

    throw new Error(`Session ${id} is still drafting`);
}

function put(
    app: FastifyInstance,
    token: string,
    url: string,
    payload: object,
) {
    return app.inject({
        method: 'PUT',
        url,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload,
    });
}

test('a teacher drafts a session from a module; it is stored with the brain game first, its competencies, and its page sources (FR-010)', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);

    const response = await post(
        app,
        token,
        `/api/modules/${moduleId}/sessions`,
        {},
    );

    assert.equal(response.statusCode, 202);
    const session = await settled(app, token, response.json().id);
    assert.equal(session.drafting, null);
    assert.equal(session.status, 'draft');
    assert.equal(session.version, 1);
    assert.equal(session.title, 'Kancil berbagi roti');
    assert.deepEqual(
        session.blocks.map(({ kind }) => kind),
        [
            'brain_game',
            'hook',
            'story',
            'check',
            'story',
            'check',
            'challenge',
            'reflection',
        ],
    );
    assert.deepEqual(session.blocks[3].competencies, ['C1']);
    assert.deepEqual(session.blocks[6].sourcePages, [4]);

    const user = provider.requests[0].body.messages[1].content;
    assert.match(user, /C1: Mengenali 1\/4 pada gambar\./);
    assert.match(user, /<material>\n\[Page 1\]\nPecahan adalah bagian/);
});

test('a draft that breaks the rules twice is not stored, and the session says it failed (AT-12)', async (t) => {
    const uncovered = {
        ...draft,
        blocks: draft.blocks.filter(
            (block) =>
                !(block.kind === 'check' && block.competencies[0] === 'C1'),
        ),
    };
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(uncovered)) },
        { body: completion(JSON.stringify(uncovered)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);

    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    const session = await settled(app, token, id);

    assert.equal(session.drafting, 'failed');
    assert.equal(session.draftError, 'invalid_output');
    assert.deepEqual(session.blocks, []);
    assert.match(
        provider.requests[1].body.messages.at(-1)?.content ?? '',
        /C1/,
    );
});

test('without AI the request answers 503 and stores no session', async (t) => {
    const app = await testApp(t);
    const { token, moduleId } = await teacherWithModule(app);

    const response = await post(
        app,
        token,
        `/api/modules/${moduleId}/sessions`,
        {},
    );

    assert.equal(response.statusCode, 503);
    assert.equal(response.json().name, 'AI_NOT_CONFIGURED');
    assert.deepEqual(
        await app.db
            .select({ id: learningSessions.id })
            .from(learningSessions)
            .where(eq(learningSessions.moduleId, moduleId)),
        [],
    );
});

test('a revision sends the current draft and the note, and raises the version', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
        {
            body: completion(
                JSON.stringify({ ...draft, title: 'Kancil berbagi kue' }),
            ),
        },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    await settled(app, token, id);

    const note = 'Pakai contoh kue, bukan roti.';
    const response = await post(
        app,
        token,
        `/api/studio/sessions/${id}/revisions`,
        { note },
    );

    assert.equal(response.statusCode, 202);
    const revised = await settled(app, token, id);
    assert.equal(revised.version, 2);
    assert.equal(revised.title, 'Kancil berbagi kue');

    const user = provider.requests[1].body.messages[1].content;
    assert.match(user, /Pakai contoh kue, bukan roti\./);
    assert.match(user, /Kancil berbagi roti/);
});

test("the teacher edits a screen's text, checked by the block rules", async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    const session = await settled(app, token, id);
    const story = session.blocks.find(({ kind }) => kind === 'story');
    const check = session.blocks.find(({ kind }) => kind === 'check');
    assert.ok(story && check);
    const url = (blockId: number) =>
        `/api/studio/sessions/${id}/blocks/${blockId}`;

    const edited = await put(app, token, url(story.id), {
        content: { text: 'Kancil punya roti besar. Ia membaginya empat.' },
    });
    assert.equal(edited.statusCode, 200);
    const after = await settled(app, token, id);
    assert.equal(
        after.blocks.find(({ id: blockId }) => blockId === story.id)?.content
            .text,
        'Kancil punya roti besar. Ia membaginya empat.',
    );

    const long = await put(app, token, url(story.id), {
        content: { text: 'Satu kalimat. Dua kalimat. Tiga kalimat.' },
    });
    assert.equal(long.statusCode, 400);
    assert.equal(long.json().details[0].field, 'content/text');

    const reshaped = await put(app, token, url(check.id), {
        content: {
            ...check.content,
            options: [
                { id: 'a', label: 'Roti A' },
                { id: 'c', label: 'Roti C' },
            ],
        },
    });
    assert.equal(reshaped.statusCode, 400);
    assert.equal(reshaped.json().details[0].field, 'content/options');
});

test("another teacher's session answers 404, and a session being drafted cannot be revised", async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)), delay: 300 },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const other = await loginAs(app, (await createUser(app)).username);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();

    assert.equal(
        (await get(app, token, `/api/studio/sessions/${id}`)).json().drafting,
        'generating',
    );
    const busy = await post(
        app,
        token,
        `/api/studio/sessions/${id}/revisions`,
        {
            note: 'Lebih singkat.',
        },
    );
    assert.equal(busy.statusCode, 409);
    assert.equal(busy.json().name, 'SESSION_DRAFTING');

    assert.equal(
        (await get(app, other, `/api/studio/sessions/${id}`)).statusCode,
        404,
    );
    assert.equal(
        (
            await post(app, other, `/api/studio/sessions/${id}/revisions`, {
                note: 'x',
            })
        ).statusCode,
        404,
    );
    assert.equal(
        (await post(app, other, `/api/modules/${moduleId}/sessions`, {}))
            .statusCode,
        404,
    );

    await settled(app, token, id);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import { learningSessions } from '../src/db/schema.ts';
import { diagramsOf, sessionBlock } from '../src/learning/blocks.ts';
import { completion, stubProvider } from './ai-stub.ts';
import { createUser, loginAs, testApp } from './helpers.ts';
import {
    allShapes,
    brokenDraft,
    c1,
    draft,
    drawnDraft,
    get,
    post,
    put,
    quarters,
    settled,
    teacherWithModule,
    type Session,
} from './studio-fixtures.ts';

const drawnDiagrams = [
    allShapes,
    quarters,
    allShapes,
    quarters,
    allShapes,
    quarters,
];

function storedDiagrams(session: Session) {
    return session.blocks.flatMap(({ kind, content }) =>
        diagramsOf(sessionBlock.parse({ kind, content })).map(
            ({ diagram }) => diagram,
        ),
    );
}

type Chapter = {
    id: number;
    competencies: { id: number; code: string }[];
    sessions: { competencies: string[] }[];
};

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
            'extra_challenge',
        ],
    );
    assert.deepEqual(session.blocks[3].competencies, ['C1']);
    assert.deepEqual(session.blocks[6].sourcePages, [4]);

    const user = provider.requests[0].body.messages[1].content;
    assert.match(user, /C1: Mengenali 1\/4 pada gambar\./);
    assert.match(user, /<material>\n\[Page 1\]\nPecahan adalah bagian/);
});

test('a draft that breaks the rules three times is not stored, and the session says it failed (AT-12)', async (t) => {
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

test('a drawn draft is stored with every diagram as the model drew it, under the diagram rules', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(drawnDraft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    const session = await settled(app, token, id);

    assert.equal(session.drafting, null);
    assert.deepEqual(storedDiagrams(session), drawnDiagrams);

    const system = provider.requests[0].body.messages[0].content;
    assert.match(system, /160 wide and 120 high/);
    assert.match(system, /"parts"/);
    assert.doesNotMatch(system, /There are no pictures/);
});

test('a draft with broken diagrams is repaired once with every problem named', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(brokenDraft)) },
        { body: completion(JSON.stringify(drawnDraft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    const session = await settled(app, token, id);

    assert.equal(session.drafting, null);
    assert.deepEqual(storedDiagrams(session), drawnDiagrams);

    const repair = provider.requests[1].body.messages.at(-1)?.content ?? '';
    assert.match(repair, /Block 2 \(story\): diagram\.shapes\.0\.width/);
    assert.match(repair, /hints\.1\.diagram\.label/);
});

test('a draft with broken diagrams three times is not stored, after two repairs', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(brokenDraft)) },
        { body: completion(JSON.stringify(brokenDraft)) },
        { body: completion(JSON.stringify(brokenDraft)) },
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
    assert.equal(provider.requests.length, 3);
});

test('a revision sends the stored diagrams with screen numbers and asks to keep them', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(drawnDraft)) },
        { body: completion(JSON.stringify(drawnDraft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    await settled(app, token, id);

    const response = await post(
        app,
        token,
        `/api/studio/sessions/${id}/revisions`,
        { note: 'Tambahkan gambar pada petunjuk 2 di layar 4.' },
    );

    assert.equal(response.statusCode, 202);
    await settled(app, token, id);

    const [system, user] = provider.requests[1].body.messages.map(
        ({ content }) => content,
    );
    assert.ok(user.includes(quarters.label));
    assert.ok(user.includes('"screen":3'));
    assert.ok(system.includes('copy each of its diagrams unchanged'));
});

test('a cut-off first draft is asked for fewer diagrams, a cut-off revision to keep them', async (t) => {
    const cut = completion(JSON.stringify(drawnDraft).slice(0, 200), 'length');
    const provider = await stubProvider(t, [
        { body: cut },
        { body: completion(JSON.stringify(drawnDraft)) },
        { body: cut },
        { body: completion(JSON.stringify(drawnDraft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    await settled(app, token, id);
    await post(app, token, `/api/studio/sessions/${id}/revisions`, {});
    const revised = await settled(app, token, id);

    assert.equal(revised.drafting, null);
    const [drafted, revisedRepair] = [1, 3].map(
        (index) => provider.requests[index].body.messages.at(-1)?.content ?? '',
    );
    assert.match(drafted, /at most 5 diagrams/);
    assert.match(revisedRepair, /keep every diagram/);
    assert.doesNotMatch(revisedRepair, /at most 5 diagrams/);
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

type Picture = { text: string; diagram?: object };
type CheckContent = {
    prompt: string;
    diagram?: object;
    hints: Picture[];
    example: Picture;
};

test('a text edit keeps every diagram, and a diagram can only be kept or removed', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(drawnDraft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    const session = await settled(app, token, id);
    const [, , story, check, plain] = session.blocks;
    const url = (blockId: number) =>
        `/api/studio/sessions/${id}/blocks/${blockId}`;
    const content = check.content as CheckContent;
    const storedCheck = async () =>
        (await settled(app, token, id)).blocks.find(
            ({ id: blockId }) => blockId === check.id,
        )?.content as CheckContent;
    const refused = (
        response: Awaited<ReturnType<typeof put>>,
        field: string,
    ) => {
        assert.equal(response.statusCode, 400);
        assert.equal(response.json().name, 'VALIDATION_ERROR');
        assert.deepEqual(response.json().details, [
            { field, message: 'A picture can only be kept or removed' },
        ]);
    };

    const retexted = await put(app, token, url(check.id), {
        content: { ...content, prompt: 'Roti mana yang dibagi empat?' },
    });
    assert.equal(retexted.statusCode, 200);
    const kept = await storedCheck();
    assert.equal(kept.prompt, 'Roti mana yang dibagi empat?');
    assert.deepEqual(kept.hints[1].diagram, quarters);
    assert.deepEqual(kept.example.diagram, allShapes);

    const removed = await put(app, token, url(check.id), {
        content: { ...kept, example: { text: kept.example.text } },
    });
    assert.equal(removed.statusCode, 200);
    const without = await storedCheck();
    assert.equal(without.example.diagram, undefined);
    assert.deepEqual(without.hints[1].diagram, quarters);

    refused(
        await put(app, token, url(check.id), {
            content: {
                ...without,
                hints: without.hints.map((hint, index) =>
                    index === 1
                        ? {
                              ...hint,
                              diagram: {
                                  ...quarters,
                                  label: `${quarters.label} Bagian lain putih.`,
                              },
                          }
                        : hint,
                ),
            },
        }),
        'content/hints/1/diagram',
    );
    refused(
        await put(app, token, url(plain.id), {
            content: { ...plain.content, diagram: quarters },
        }),
        'content/diagram',
    );
    refused(
        await put(app, token, url(check.id), {
            content: {
                ...without,
                example: { ...without.example, diagram: allShapes },
            },
        }),
        'content/example/diagram',
    );

    const malformed = await put(app, token, url(story.id), {
        content: {
            ...story.content,
            diagram: {
                ...quarters,
                shapes: [{ ...quarters.shapes[0], x: 150 }, quarters.shapes[1]],
            },
        },
    });
    assert.equal(malformed.statusCode, 400);
    assert.ok(
        malformed
            .json()
            .details.every(({ field }: { field: string }) =>
                field.startsWith('content/diagram/'),
            ),
    );
    assert.deepEqual(await storedCheck(), without);
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

test('a teacher chooses the competencies a session teaches: AI drafts only those, and the review checks only those (T-06)', async (t) => {
    const onlyC1 = {
        ...draft,
        blocks: draft.blocks.map((block) => ({
            ...block,
            competencies: block.competencies.length > 0 ? ['C1'] : [],
        })),
    };
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(onlyC1)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, materialId, moduleId } = await teacherWithModule(app);
    const chapter = async () => {
        const material: { modules: Chapter[] } = (
            await get(app, token, `/api/materials/${materialId}`)
        ).json();

        return material.modules.find(({ id }) => id === moduleId);
    };
    const first = (await chapter())?.competencies[0];

    assert.ok(first);

    const response = await post(
        app,
        token,
        `/api/modules/${moduleId}/sessions`,
        { competencyIds: [first.id] },
    );

    assert.equal(response.statusCode, 202);
    await settled(app, token, response.json().id);

    const studio = (
        await get(app, token, `/api/studio/sessions/${response.json().id}`)
    ).json();
    const user = provider.requests[0].body.messages[1].content;

    assert.equal(studio.drafting, null);
    assert.match(user, /C1: Mengenali 1\/4 pada gambar\./);
    assert.doesNotMatch(user, /C2: /);
    assert.deepEqual(studio.competencies, [
        { code: 'C1', description: c1.description },
    ]);
    assert.deepEqual(studio.issues, []);
    assert.deepEqual(
        (await chapter())?.sessions.map(({ competencies }) => competencies),
        [['C1']],
    );
});

test('a session needs at least one competency, and only competencies of its own chapter (T-06)', async (t) => {
    const app = await testApp(t);
    const { token, materialId, moduleId } = await teacherWithModule(app);
    const other: { competencies: { id: number }[] } = (
        await post(app, token, `/api/materials/${materialId}/modules`, {
            title: 'Comparing fractions',
            firstPage: 1,
            lastPage: 4,
            competencies: [c1],
        })
    ).json();
    const create = (competencyIds: number[]) =>
        post(app, token, `/api/modules/${moduleId}/sessions`, {
            competencyIds,
        });

    for (const response of [
        await create([]),
        await create(other.competencies.map(({ id }) => id)),
    ]) {
        assert.equal(response.statusCode, 400);
        assert.equal(response.json().name, 'VALIDATION_ERROR');
        assert.equal(response.json().details[0].field, 'competencyIds');
    }

    assert.deepEqual(
        await app.db
            .select({ id: learningSessions.id })
            .from(learningSessions)
            .where(eq(learningSessions.moduleId, moduleId)),
        [],
    );
});

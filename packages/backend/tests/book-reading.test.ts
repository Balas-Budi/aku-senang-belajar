import assert from 'node:assert/strict';
import { test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AiConfig } from '../src/ai/chat.ts';
import {
    materialChunks,
    materialPages,
    materialVersions,
    modules,
} from '../src/db/schema.ts';
import { storeModule } from '../src/materials/store-module.ts';
import { checkOutline, readNext } from '../src/materials/reading.ts';
import { completion, stubProvider } from './ai-stub.ts';
import { createUser, loginAs, testApp, TEST_ORIGIN } from './helpers.ts';
import { pdfOf } from './pdf.ts';
import {
    c1,
    c2,
    draftedSession,
    get,
    post,
    settled,
    teacherWithMaterial,
    teacherWithModule,
} from './studio-fixtures.ts';

const book = [
    'Daftar isi\nBab 1 Pecahan ........ 2\nGlosarium ........ 5',
    'Bab 1 Pecahan: bagian dari benda utuh',
    'Pecahan adalah bagian dari satu benda utuh yang dibagi sama besar.',
    'Pembilang menunjukkan bagian yang diambil dari seluruh bagian.',
    'Glosarium: pecahan, pembilang, penyebut, dan bagian yang sama besar.',
];

const description = 'Lingkaran dibagi empat sama besar, satu bagian diarsir.';

async function readAll(
    app: FastifyInstance,
    config: AiConfig,
    materialId: number,
) {
    for (let round = 0; round < 10; round++) {
        await app.db
            .update(materialVersions)
            .set({ readAfter: new Date(0) })
            .where(eq(materialVersions.materialId, materialId));

        if (!(await readNext(app, config, { materialId }))) return;
    }

    throw new Error('The reading did not settle');
}

function send(
    app: FastifyInstance,
    method: 'PATCH' | 'DELETE' | 'POST',
    token: string,
    url: string,
    payload?: object,
) {
    return app.inject({
        method,
        url,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        ...(payload ? { payload } : {}),
    });
}

test('the AI reads a pictured page, outlines the book, and stores its chapters with competencies', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify({ description })) },
        {
            body: completion(
                JSON.stringify({
                    chapters: [{ title: 'Pecahan', firstPage: 2, lastPage: 4 }],
                }),
            ),
        },
        {
            body: completion(
                JSON.stringify({
                    competencies: [
                        { ...c1, pages: [2] },
                        { ...c2, pages: [3, 4] },
                    ],
                }),
            ),
        },
    ]);
    const app = await testApp(t, provider.config);
    const { token, material } = await teacherWithMaterial(
        app,
        pdfOf(book, [2]),
    );

    assert.equal(material.reading.state, 'reading_pages');
    assert.equal(material.reading.pictured, 1);

    await readAll(app, provider.config, material.id);

    const vision = provider.requests[0];
    assert.match(vision.text, /data:image\/jpeg;base64,/);
    assert.match(vision.body.messages[1]?.content ?? '', /\[Page 2\]/);
    assert.match(
        provider.requests[1].body.messages[1]?.content ?? '',
        /\[Page 2\]\nBab 1 Pecahan: bagian dari benda utuh\n\n\[Isi gambar\] Lingkaran dibagi empat/,
    );
    assert.match(
        provider.requests[2].body.messages[1]?.content ?? '',
        /Module: Pecahan/,
    );
    assert.doesNotMatch(
        provider.requests[2].body.messages[1]?.content ?? '',
        /\[Page 5\]/,
    );

    const detail = (
        await get(app, token, `/api/materials/${material.id}`)
    ).json();
    assert.deepEqual(detail.reading, {
        state: 'done',
        error: null,
        pictured: 0,
        described: 1,
        chapters: 1,
    });
    assert.deepEqual(
        detail.modules.map(
            (module: {
                title: string;
                firstPage: number;
                lastPage: number;
                madeBy: string;
                competencies: { code: string; pages: number[] }[];
            }) => [
                module.title,
                module.firstPage,
                module.lastPage,
                module.madeBy,
                module.competencies.map(({ code, pages }) => [code, pages]),
            ],
        ),
        [
            [
                'Pecahan',
                2,
                4,
                'ai',
                [
                    ['C1', [2]],
                    ['C2', [3, 4]],
                ],
            ],
        ],
    );

    const page = (
        await get(app, token, `/api/materials/${material.id}/pages/2`)
    ).json();
    assert.deepEqual(page, {
        number: 2,
        text: 'Bab 1 Pecahan: bagian dari benda utuh',
        visual: description,
    });

    const chunks = await app.db
        .select({
            position: materialChunks.position,
            text: materialChunks.text,
        })
        .from(materialChunks)
        .where(
            and(
                eq(materialChunks.materialId, material.id),
                eq(materialChunks.pageNumber, 2),
            ),
        );
    assert.ok(
        chunks.some(
            ({ position, text }) => position >= 1000 && text === description,
        ),
    );
});

test('an outline that overlaps, runs past the book, or spans over 60 pages is sent back', () => {
    const readable = new Set([2, 3, 4, 70]);
    const check = checkOutline(80, readable);

    assert.match(
        check({
            chapters: [
                { title: 'A', firstPage: 2, lastPage: 4 },
                { title: 'B', firstPage: 4, lastPage: 6 },
            ],
        }) ?? '',
        /not after the chapter before it/,
    );
    assert.match(
        check({ chapters: [{ title: 'A', firstPage: 2, lastPage: 90 }] }) ?? '',
        /the book has 80 pages/,
    );
    assert.match(
        check({ chapters: [{ title: 'A', firstPage: 2, lastPage: 70 }] }) ?? '',
        /at most 60/,
    );
    assert.match(
        check({ chapters: [{ title: 'A', firstPage: 5, lastPage: 6 }] }) ?? '',
        /no page with content/,
    );
    assert.equal(
        check({
            chapters: [
                { title: 'A', firstPage: 2, lastPage: 4 },
                { title: 'B', firstPage: 60, lastPage: 75 },
            ],
        }),
        null,
    );
});

test('a reading that fails three times stops, and the owner starts it again', async (t) => {
    const provider = await stubProvider(t, [
        { status: 500 },
        { status: 500 },
        { status: 500 },
    ]);
    const app = await testApp(t, provider.config);
    const { token, material } = await teacherWithMaterial(app, pdfOf(book));
    const other = await loginAs(app, (await createUser(app)).username);
    const version = and(
        eq(materialVersions.materialId, material.id),
        eq(materialVersions.version, 1),
    );

    for (let round = 0; round < 6; round++) {
        await app.db
            .update(materialVersions)
            .set({ readAfter: new Date(0) })
            .where(version);
        await readNext(app, provider.config, { materialId: material.id });
    }

    const failed = (
        await get(app, token, `/api/materials/${material.id}`)
    ).json();
    assert.equal(failed.reading.state, 'failed');
    assert.equal(failed.reading.error, 'http');

    const foreign = await send(
        app,
        'POST',
        other,
        `/api/materials/${material.id}/reading`,
    );
    assert.equal(foreign.statusCode, 404);

    const again = await send(
        app,
        'POST',
        token,
        `/api/materials/${material.id}/reading`,
    );
    assert.equal(again.statusCode, 202);

    const [row] = await app.db
        .select({
            reading: materialVersions.reading,
            tries: materialVersions.readingTries,
        })
        .from(materialVersions)
        .where(version);
    assert.deepEqual(row, { reading: 'reading_pages', tries: 0 });

    const twice = await send(
        app,
        'POST',
        token,
        `/api/materials/${material.id}/reading`,
    );
    assert.equal(twice.statusCode, 409);
    assert.equal(twice.json().name, 'READING_NOT_FAILED');
});

test('the owner renames a chapter and removes one without missions', async (t) => {
    const provider = await stubProvider(t, [{ status: 500 }]);
    const app = await testApp(t, provider.config);
    const { token, materialId, moduleId } = await teacherWithModule(app);
    const other = await loginAs(app, (await createUser(app)).username);
    const url = `/api/materials/${materialId}/modules/${moduleId}`;

    const foreign = await send(app, 'PATCH', other, url, { title: 'Lain' });
    assert.equal(foreign.statusCode, 404);

    const renamed = await send(app, 'PATCH', token, url, {
        title: 'Pecahan sederhana',
    });
    assert.equal(renamed.statusCode, 200);
    assert.equal(
        renamed.json().modules.find(({ id }: { id: number }) => id === moduleId)
            .title,
        'Pecahan sederhana',
    );

    await draftedSession(app, token, moduleId);

    const kept = await send(app, 'DELETE', token, url);
    assert.equal(kept.statusCode, 409);
    assert.equal(kept.json().name, 'MODULE_HAS_SESSIONS');

    const spare = await app.db.transaction((tx) =>
        storeModule(tx, {
            materialId,
            version: 1,
            title: 'Cadangan',
            firstPage: 1,
            lastPage: 1,
            madeBy: 'ai',
            competencies: [c1],
        }),
    );
    const removed = await send(
        app,
        'DELETE',
        token,
        `/api/materials/${materialId}/modules/${spare.id}`,
    );
    assert.equal(removed.statusCode, 204);

    const left = await app.db
        .select({ id: modules.id })
        .from(modules)
        .where(eq(modules.id, spare.id));
    assert.equal(left.length, 0);
});

test('a chapter over 20 readable pages sends the pages its competencies rest on, up to 20', async (t) => {
    const provider = await stubProvider(t, [{ status: 500 }]);
    const app = await testApp(t, provider.config);
    const pages = Array.from(
        { length: 30 },
        (_, index) =>
            `Halaman ${index + 1} membahas pecahan dengan contoh roti dan kue.`,
    );
    const { token, material } = await teacherWithMaterial(app, pdfOf(pages));
    const chapter = await app.db.transaction((tx) =>
        storeModule(tx, {
            materialId: material.id,
            version: 1,
            title: 'Pecahan',
            firstPage: 1,
            lastPage: 30,
            madeBy: 'ai',
            competencies: [
                { ...c1, pages: [27] },
                { ...c2, pages: [29] },
            ],
        }),
    );
    const { id } = (
        await post(app, token, `/api/modules/${chapter.id}/sessions`, {})
    ).json();

    await settled(app, token, id);

    const sent = provider.requests[0].body.messages[1]?.content ?? '';
    const numbers = [...sent.matchAll(/\[Page (\d+)\]/g)].map(([, n]) =>
        Number(n),
    );

    assert.equal(numbers.length, 20);
    assert.ok(numbers.includes(27));
    assert.ok(numbers.includes(29));
    assert.deepEqual(
        numbers,
        [...numbers].sort((a, b) => a - b),
    );
});

test('a pictured page that never renders is given up after its tries, and the book is still outlined', async (t) => {
    const provider = await stubProvider(t, [
        { status: 500 },
        { status: 500 },
        { status: 500 },
        {
            body: completion(
                JSON.stringify({
                    chapters: [{ title: 'Pecahan', firstPage: 3, lastPage: 4 }],
                }),
            ),
        },
        {
            body: completion(
                JSON.stringify({
                    competencies: [
                        { ...c1, pages: [3] },
                        { ...c2, pages: [4] },
                    ],
                }),
            ),
        },
    ]);
    const app = await testApp(t, provider.config);
    const { material } = await teacherWithMaterial(app, pdfOf(book, [2]));

    await readNext(app, provider.config, { materialId: material.id });

    const [waiting] = await app.db
        .select({ readAfter: materialVersions.readAfter })
        .from(materialVersions)
        .where(eq(materialVersions.materialId, material.id));
    assert.ok(waiting.readAfter.getTime() > Date.now() + 20_000);

    await readAll(app, provider.config, material.id);

    const [page] = await app.db
        .select({
            visual: materialPages.visual,
            pictured: materialPages.pictured,
            tries: materialPages.visualTries,
        })
        .from(materialPages)
        .where(
            and(
                eq(materialPages.materialId, material.id),
                eq(materialPages.number, 2),
            ),
        );
    assert.deepEqual(page, { visual: null, pictured: false, tries: 3 });

    const chapters = await app.db
        .select({ title: modules.title })
        .from(modules)
        .where(eq(modules.materialId, material.id));
    assert.deepEqual(chapters, [{ title: 'Pecahan' }]);
});

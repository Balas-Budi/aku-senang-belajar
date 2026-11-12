import assert from 'node:assert/strict';
import { test } from 'node:test';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { materialChunks, materialPages, materials } from '../src/db/schema.ts';
import {
    chunkPages,
    chunkStoredMaterials,
    embedNextChunks,
    MAX_EMBED_TRIES,
    retryFailedChunks,
    searchMaterial,
} from '../src/materials/chunks.ts';
import { basis, stubEmbedder } from './ai-stub.ts';
import {
    createUser,
    loginAs,
    openBooks,
    TEST_ORIGIN,
    testApp,
} from './helpers.ts';
import { pdfOf } from './pdf.ts';

const longPage = 'A fraction names equal parts of one whole.\n'.repeat(40);

function chunksOf(app: FastifyInstance, materialId: number) {
    return app.db
        .select({
            id: materialChunks.id,
            pageNumber: materialChunks.pageNumber,
            position: materialChunks.position,
            text: materialChunks.text,
            embedding: materialChunks.embedding,
            tries: materialChunks.tries,
            embedAfter: materialChunks.embedAfter,
            embeddedAt: materialChunks.embeddedAt,
        })
        .from(materialChunks)
        .where(eq(materialChunks.materialId, materialId))
        .orderBy(asc(materialChunks.pageNumber), asc(materialChunks.position));
}

async function storedMaterial(
    app: FastifyInstance,
    pages: (string | null)[],
    { chunked = true } = {},
) {
    const owner = await createUser(app);
    const [material] = await app.db
        .insert(materials)
        .values({
            subject: 'mathematics',
            title: 'Chunk test book',
            ownerId: owner.id,
        })
        .returning({ id: materials.id });

    await app.db.insert(materialPages).values(
        pages.map((text, index) => ({
            materialId: material.id,
            number: index + 1,
            text,
        })),
    );

    if (chunked) {
        const chunks = await chunkPages(pages);

        await app.db
            .insert(materialChunks)
            .values(
                chunks.map((chunk) => ({ ...chunk, materialId: material.id })),
            );
    }

    return material.id;
}

test('an upload splits its readable pages into chunks that keep their page numbers', async (t) => {
    const app = await testApp(t);
    const user = await createUser(app);
    const token = await loginAs(app, user.username);
    const query = new URLSearchParams({
        title: 'Fractions',
        subject: 'mathematics',
        grade: '4',
        rights: '1',
    });

    const response = await app.inject({
        method: 'POST',
        url: `/api/materials?${query}`,
        headers: { origin: TEST_ORIGIN, 'content-type': 'application/pdf' },
        cookies: { session: token },
        payload: pdfOf([longPage, '', 'One quarter is written 1/4.']),
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(await chunksOf(app, response.json().id), []);

    await openBooks(app);

    const chunks = await chunksOf(app, response.json().id);
    const firstPage = chunks.filter((chunk) => chunk.pageNumber === 1);

    assert.ok(firstPage.length >= 2);
    assert.deepEqual(
        firstPage.map((chunk) => chunk.position),
        firstPage.map((_, index) => index),
    );
    assert.ok(chunks.every((chunk) => chunk.text.length <= 1200));
    assert.equal(chunks.filter((chunk) => chunk.pageNumber === 2).length, 0);
    assert.deepEqual(
        chunks
            .filter((chunk) => chunk.pageNumber === 3)
            .map((chunk) => chunk.text),
        ['One quarter is written 1/4.'],
    );
    assert.ok(
        chunks.every(
            (chunk) =>
                chunk.embedding === null &&
                chunk.embeddedAt === null &&
                chunk.tries === 0,
        ),
    );
});

test('the runner embeds waiting chunks in one batch and records when', async (t) => {
    const app = await testApp(t);
    const materialId = await storedMaterial(app, [
        'Halves are two equal parts.',
        'Quarters are four equal parts.',
    ]);
    const provider = await stubEmbedder(t, (texts) => ({
        vectors: texts.map((_, index) => basis(index)),
    }));

    assert.equal(
        await embedNextChunks(app, provider.config, { materialId }),
        true,
    );
    assert.equal(
        await embedNextChunks(app, provider.config, { materialId }),
        false,
    );

    const chunks = await chunksOf(app, materialId);

    assert.equal(provider.requests.length, 1);
    assert.deepEqual(provider.requests[0].body.input, [
        'Halves are two equal parts.',
        'Quarters are four equal parts.',
    ]);
    assert.deepEqual(
        chunks.map((chunk) => chunk.embedding?.[chunk.pageNumber - 1]),
        [1, 1],
    );
    assert.ok(
        chunks.every(
            (chunk) => chunk.embeddedAt instanceof Date && chunk.tries === 1,
        ),
    );
});

test('a failed batch waits a minute, then five, stops after three tries, and starts again once retried', async (t) => {
    const app = await testApp(t);
    const materialId = await storedMaterial(app, ['Thirds are three parts.']);
    const provider = await stubEmbedder(t, () => ({ status: 503 }));
    const due = () =>
        app.db
            .update(materialChunks)
            .set({ embedAfter: new Date(Date.now() - 1000) })
            .where(eq(materialChunks.materialId, materialId));

    const started = Date.now();

    assert.equal(
        await embedNextChunks(app, provider.config, { materialId }),
        false,
    );

    let [chunk] = await chunksOf(app, materialId);

    assert.equal(chunk.tries, 1);
    assert.equal(chunk.embedding, null);
    assert.ok(chunk.embedAfter.getTime() >= started + 59_000);
    assert.equal(
        await embedNextChunks(app, provider.config, { materialId }),
        false,
    );
    assert.equal(provider.requests.length, 1);

    await due();
    await embedNextChunks(app, provider.config, { materialId });
    [chunk] = await chunksOf(app, materialId);
    assert.equal(chunk.tries, 2);
    assert.ok(chunk.embedAfter.getTime() >= Date.now() + 4 * 60_000);

    await due();
    await embedNextChunks(app, provider.config, { materialId });
    await due();
    await embedNextChunks(app, provider.config, { materialId });
    [chunk] = await chunksOf(app, materialId);
    assert.equal(chunk.tries, MAX_EMBED_TRIES);
    assert.equal(provider.requests.length, MAX_EMBED_TRIES);

    await due();
    assert.equal(
        await embedNextChunks(app, provider.config, { materialId }),
        false,
    );
    assert.equal(provider.requests.length, MAX_EMBED_TRIES);
    assert.equal(await retryFailedChunks(app.db, { materialId }), 1);
    [chunk] = await chunksOf(app, materialId);
    assert.equal(chunk.tries, 0);
    assert.ok(chunk.embedAfter.getTime() <= Date.now());
});

test('a search returns the nearest chunks of one material with their pages, leaving out other materials and chunks without vectors', async (t) => {
    const app = await testApp(t);
    const materialId = await storedMaterial(app, [
        'Halves are two equal parts.',
        'Quarters are four equal parts.',
        'Thirds are three equal parts.',
        'This page is not embedded yet.',
    ]);
    const otherId = await storedMaterial(app, ['Quarters in another book.']);
    const chunks = await chunksOf(app, materialId);
    const [other] = await chunksOf(app, otherId);

    for (const chunk of chunks.slice(0, 3)) {
        await app.db
            .update(materialChunks)
            .set({ embedding: basis(chunk.pageNumber) })
            .where(eq(materialChunks.id, chunk.id));
    }
    await app.db
        .update(materialChunks)
        .set({ embedding: basis(2) })
        .where(eq(materialChunks.id, other.id));

    const provider = await stubEmbedder(t, () => ({ vectors: [basis(2)] }));
    const found = await searchMaterial(
        app.db,
        provider.config,
        materialId,
        'How many parts is a quarter?',
        2,
    );

    assert.deepEqual(provider.requests[0].body.input, [
        'How many parts is a quarter?',
    ]);
    assert.equal(found.length, 2);
    assert.equal(found[0].pageNumber, 2);
    assert.equal(found[0].text, 'Quarters are four equal parts.');
    assert.equal(found[0].distance, 0);
    assert.equal(found[1].distance, 1);
    assert.ok(found.every((chunk) => chunk.pageNumber !== 4));
});

test('chunk-materials splits a stored material that has no chunks yet, once', async (t) => {
    const app = await testApp(t);
    const materialId = await storedMaterial(
        app,
        ['Halves are two equal parts.', null],
        { chunked: false },
    );

    assert.equal(await chunkStoredMaterials(app.db, { materialId }), 1);
    assert.equal(await chunkStoredMaterials(app.db, { materialId }), 0);

    const chunks = await app.db
        .select({ pageNumber: materialChunks.pageNumber })
        .from(materialChunks)
        .where(and(eq(materialChunks.materialId, materialId)));

    assert.deepEqual(chunks, [{ pageNumber: 1 }]);
});

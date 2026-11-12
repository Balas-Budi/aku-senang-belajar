import assert from 'node:assert/strict';
import { test } from 'node:test';
import { and, count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { materialChunks, materials } from '../src/db/schema.ts';
import { completion, stubProvider } from './ai-stub.ts';
import {
    createUser,
    loginAs,
    randomUsername,
    TEST_ORIGIN,
    testApp,
} from './helpers.ts';
import { pdfOf } from './pdf.ts';
import {
    c1,
    draft,
    get,
    post,
    put,
    settled,
    teacherWithModule,
} from './studio-fixtures.ts';

const newPages = [
    'Desimal adalah cara lain menulis pecahan.\nSetengah ditulis 0,5.',
    'Persen berarti per seratus.\nSetengah sama dengan 50 persen.',
];

function sendPdf(
    app: FastifyInstance,
    token: string,
    url: string,
    file: Buffer,
    contentType = 'application/pdf',
) {
    return app.inject({
        method: 'POST',
        url,
        headers: { origin: TEST_ORIGIN, 'content-type': contentType },
        cookies: { session: token },
        payload: file,
    });
}

function upload(
    app: FastifyInstance,
    token: string,
    query: Record<string, string> = {},
) {
    const params = new URLSearchParams({
        title: 'Mengenal pecahan',
        subject: 'mathematics',
        grade: '4',
        rights: '1',
        ...query,
    });

    return sendPdf(app, token, `/api/materials?${params}`, pdfOf(newPages));
}

const chapter = { title: 'Desimal', firstPage: 1, lastPage: 2 };

test('a material records where it comes from and by what right, and an archived one takes nothing new (FR-013)', async (t) => {
    const app = await testApp(t);
    const token = await loginAs(app, (await createUser(app)).username);
    const stranger = await loginAs(app, (await createUser(app)).username);
    const created = await upload(app, token, {
        source: '  Buku Matematika Kelas 4, Penerbit Contoh  ',
        licence: 'school',
        licenceNote: 'Dibeli sekolah tahun 2026.',
    });

    assert.equal(created.statusCode, 201);

    const material = created.json();
    const url = `/api/materials/${material.id}`;

    assert.deepEqual(
        {
            version: material.version,
            archived: material.archived,
            source: material.source,
            licence: material.licence,
            licenceNote: material.licenceNote,
            versions: material.versions.map(
                ({ createdAt: _, ...version }: { createdAt: string }) =>
                    version,
            ),
        },
        {
            version: 1,
            archived: false,
            source: 'Buku Matematika Kelas 4, Penerbit Contoh',
            licence: 'school',
            licenceNote: 'Dibeli sekolah tahun 2026.',
            versions: [
                { version: 1, pageCount: 2, readablePages: 2, chapters: 0 },
            ],
        },
    );
    assert.equal(
        (await upload(app, token, { licence: 'bought' })).statusCode,
        400,
    );
    assert.equal((await upload(app, token)).json().licence, null);

    const changed = await put(app, token, url, {
        source: '   ',
        licence: 'own',
        licenceNote: null,
    });

    assert.equal(changed.statusCode, 200);
    assert.deepEqual(
        [
            changed.json().source,
            changed.json().licence,
            changed.json().licenceNote,
        ],
        [null, 'own', null],
    );
    assert.equal(
        (await put(app, token, url, { licence: 'bought' })).statusCode,
        400,
    );
    assert.equal(
        (await put(app, stranger, url, { archived: true })).statusCode,
        404,
    );

    const [prepared] = await app.db
        .insert(materials)
        .values({ subject: 'mathematics', title: randomUsername('Prepared') })
        .returning({ id: materials.id });

    assert.equal(
        (
            await put(app, token, `/api/materials/${prepared.id}`, {
                archived: true,
            })
        ).statusCode,
        404,
    );

    const module = (
        await post(app, token, `${url}/modules`, {
            ...chapter,
            competencies: [c1],
        })
    ).json();
    const archived = await put(app, token, url, { archived: true });

    assert.equal(archived.json().archived, true);
    assert.equal(archived.json().modules.length, 1);

    const list = (await get(app, token, '/api/materials')).json();
    const own = list.filter(({ prepared }: { prepared: boolean }) => !prepared);

    assert.equal(own.at(-1).id, material.id);
    assert.equal(own.at(-1).archived, true);
    assert.equal(list[0].archived, false);

    for (const refused of [
        await post(app, token, `${url}/modules`, {
            ...chapter,
            competencies: [c1],
        }),
        await post(app, token, `${url}/competency-drafts`, chapter),
        await post(app, token, `/api/modules/${module.id}/sessions`, {}),
        await sendPdf(app, token, `${url}/versions`, pdfOf(newPages)),
    ]) {
        assert.equal(refused.statusCode, 409);
        assert.equal(refused.json().name, 'MATERIAL_ARCHIVED');
    }

    assert.equal(
        (await put(app, token, url, { archived: false })).json().archived,
        false,
    );
    assert.equal(
        (
            await post(app, token, `${url}/modules`, {
                ...chapter,
                competencies: [c1],
            })
        ).statusCode,
        201,
    );
});

test('a new file becomes the next version; chapters and missions keep the version they were made from, and an earlier version can be made active again (FR-013)', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, materialId, moduleId } = await teacherWithModule(app);
    const stranger = await loginAs(app, (await createUser(app)).username);
    const url = `/api/materials/${materialId}`;
    const page = async (number: number, version?: number) =>
        get(
            app,
            token,
            `${url}/pages/${number}${version ? `?version=${version}` : ''}`,
        );

    assert.equal(
        (await sendPdf(app, stranger, `${url}/versions`, pdfOf(newPages)))
            .statusCode,
        404,
    );

    const notPdf = await sendPdf(
        app,
        token,
        `${url}/versions`,
        Buffer.from('bukan pdf'),
    );

    assert.equal(notPdf.statusCode, 400);
    assert.equal(notPdf.json().details[0].field, 'pdf');

    const uploaded = await sendPdf(
        app,
        token,
        `${url}/versions`,
        pdfOf(newPages),
    );

    assert.equal(uploaded.statusCode, 201);

    const second = uploaded.json();

    assert.equal(second.version, 2);
    assert.equal(second.pageCount, 2);
    assert.match(second.pages[0].snippet, /^Desimal adalah/);
    assert.deepEqual(
        second.versions.map(
            ({ createdAt: _, ...version }: { createdAt: string }) => version,
        ),
        [
            { version: 1, pageCount: 4, readablePages: 3, chapters: 1 },
            { version: 2, pageCount: 2, readablePages: 2, chapters: 0 },
        ],
    );
    assert.equal(second.modules[0].version, 1);
    assert.match((await page(1)).json().text, /^Desimal adalah/);
    assert.match((await page(1, 1)).json().text, /^Pecahan adalah/);
    assert.equal((await page(4)).statusCode, 404);
    assert.equal((await page(4, 1)).statusCode, 200);

    const [chunks] = await app.db
        .select({ total: count() })
        .from(materialChunks)
        .where(
            and(
                eq(materialChunks.materialId, materialId),
                eq(materialChunks.version, 2),
            ),
        );

    assert.ok(chunks.total >= 2);

    const tooFar = await post(app, token, `${url}/modules`, {
        title: 'Desimal',
        firstPage: 1,
        lastPage: 3,
        competencies: [c1],
    });

    assert.equal(tooFar.statusCode, 400);
    assert.equal(tooFar.json().details[0].field, 'lastPage');

    const made = await post(app, token, `${url}/modules`, {
        ...chapter,
        competencies: [c1],
    });

    assert.equal(made.statusCode, 201);
    assert.deepEqual(
        (await get(app, token, url))
            .json()
            .modules.map(({ version }: { version: number }) => version),
        [1, 2],
    );

    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    const session = await settled(app, token, id);

    assert.equal(session.drafting, null);
    assert.match(provider.requests[0].text, /Pecahan adalah bagian/);
    assert.doesNotMatch(provider.requests[0].text, /Desimal adalah/);
    assert.equal(
        (session as unknown as { module: { materialVersion: number } }).module
            .materialVersion,
        1,
    );

    const unknown = await put(app, token, url, { version: 9 });

    assert.equal(unknown.statusCode, 400);
    assert.equal(unknown.json().details[0].field, 'version');

    const back = await put(app, token, url, { version: 1 });

    assert.equal(back.statusCode, 200);
    assert.equal(back.json().version, 1);
    assert.equal(back.json().pageCount, 4);
    assert.match(back.json().pages[0].snippet, /^Pecahan adalah/);
    assert.equal(back.json().versions.length, 2);

    const third = await sendPdf(app, token, `${url}/versions`, pdfOf(newPages));

    assert.equal(third.json().version, 3);
});

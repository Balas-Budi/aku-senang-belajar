import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { materials } from '../src/db/schema.ts';
import {
    createStudent,
    createUser,
    loginAs,
    randomUsername,
    TEST_ORIGIN,
    TEST_STUDENT_PASSWORD,
    openBooks,
    testApp,
} from './helpers.ts';
import { pdfOf } from './pdf.ts';

const fractions = [
    'Pecahan adalah bagian dari satu benda utuh.\nRoti dibagi menjadi empat bagian yang sama besar.',
    '',
    'Satu perempat ditulis 1/4.\nPembilang menunjukkan bagian yang diambil.',
];

function upload(
    app: FastifyInstance,
    token: string,
    file: Buffer,
    query: Record<string, string | null> = {},
) {
    const params = new URLSearchParams();
    const values = {
        title: 'Mengenal pecahan',
        subject: 'mathematics',
        grade: '4',
        rights: '1',
        ...query,
    };
    for (const [key, value] of Object.entries(values)) {
        if (value !== null) params.set(key, value);
    }

    return app.inject({
        method: 'POST',
        url: `/api/materials?${params}`,
        headers: { origin: TEST_ORIGIN, 'content-type': 'application/pdf' },
        cookies: { session: token },
        payload: file,
    });
}

async function teacher(app: FastifyInstance) {
    const user = await createUser(app);
    return loginAs(app, user.username);
}

function get(app: FastifyInstance, token: string, url: string) {
    return app.inject({ method: 'GET', url, cookies: { session: token } });
}

test('a teacher uploads a PDF; each page is read, and a page without text is marked unreadable (FR-008, AT-02)', async (t) => {
    const app = await testApp(t);
    const token = await teacher(app);

    const response = await upload(app, token, pdfOf(fractions));

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().reading.state, 'opening');
    assert.equal(response.json().pageCount, 0);

    await openBooks(app);

    const material = (
        await get(app, token, `/api/materials/${response.json().id}`)
    ).json();
    assert.equal(material.reading.state, 'reading_pages');
    assert.equal(material.prepared, false);
    assert.equal(material.grade, 4);
    assert.equal(material.pageCount, 3);
    assert.equal(material.readablePages, 2);
    assert.deepEqual(
        material.pages.map(({ readable }: { readable: boolean }) => readable),
        [true, false, true],
    );
    assert.match(material.pages[0].snippet, /Pecahan adalah bagian/);
    assert.equal(material.pages[1].snippet, null);

    const list = await get(app, token, '/api/materials');
    assert.ok(
        list
            .json()
            .some(
                (entry: { id: number; readablePages: number }) =>
                    entry.id === material.id && entry.readablePages === 2,
            ),
    );

    const page = await get(app, token, `/api/materials/${material.id}/pages/1`);
    assert.equal(page.statusCode, 200);
    assert.match(page.json().text, /empat bagian yang sama besar/);
    assert.equal(
        (await get(app, token, `/api/materials/${material.id}/pages/2`)).json()
            .text,
        null,
    );
    assert.equal(
        (await get(app, token, `/api/materials/${material.id}/pages/4`))
            .statusCode,
        404,
    );
});

test('an upload needs the rights confirmed, a known subject, and a grade from 1 to 6 (FR-007)', async (t) => {
    const app = await testApp(t);
    const token = await teacher(app);
    const file = pdfOf(fractions);

    for (const [query, field] of [
        [{ rights: null }, 'rights'],
        [{ grade: '7' }, 'grade'],
        [{ subject: 'art' }, 'subject'],
        [{ title: ' ' }, 'title'],
    ] as const) {
        const response = await upload(app, token, file, query);

        assert.equal(response.statusCode, 400);
        assert.equal(response.json().name, 'VALIDATION_ERROR');
        assert.equal(response.json().details[0].field, field);
    }
});

test('a file that is not a PDF or one over 300 pages is refused; a PDF without text waits for its pages to be read', async (t) => {
    const app = await testApp(t);
    const token = await teacher(app);
    const long = Array.from(
        { length: 301 },
        () => 'Halaman ini berisi teks yang cukup panjang untuk dibaca.',
    );

    for (const file of [Buffer.from('not a pdf at all'), pdfOf(long)]) {
        const response = await upload(app, token, file);

        assert.equal(response.statusCode, 400);
        assert.equal(response.json().details[0].field, 'pdf');
    }

    const scanned = await upload(app, token, pdfOf(['', ''], [1]));

    assert.equal(scanned.statusCode, 201);
    await openBooks(app);
    assert.deepEqual(
        (await get(app, token, `/api/materials/${scanned.json().id}`)).json()
            .reading,
        {
            state: 'reading_pages',
            error: null,
            pictured: 2,
            described: 0,
            chapters: null,
        },
    );

    const json = await app.inject({
        method: 'POST',
        url: '/api/materials?title=Pecahan&subject=mathematics&grade=4&rights=1',
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload: { file: 'pdf' },
    });
    assert.equal(json.statusCode, 400);
    assert.equal(json.json().details[0].field, 'pdf');
});

test('a file over 200 MB is refused before it is read', async (t) => {
    const app = await testApp(t);
    const token = await teacher(app);

    const response = await upload(
        app,
        token,
        Buffer.alloc(200 * 1024 * 1024 + 1, 32),
    );

    assert.equal(response.statusCode, 413);
});

test("prepared materials reach every teacher; another teacher's upload answers 404", async (t) => {
    const app = await testApp(t);
    const owner = await teacher(app);
    const other = await teacher(app);
    const uploaded = (await upload(app, owner, pdfOf(fractions))).json();
    const [prepared] = await app.db
        .insert(materials)
        .values({ subject: 'mathematics', title: randomUsername('Prepared') })
        .returning({ id: materials.id });

    const list = (await get(app, other, '/api/materials')).json();

    assert.ok(
        list.some(
            (entry: { id: number; prepared: boolean }) =>
                entry.id === prepared.id && entry.prepared,
        ),
    );
    assert.ok(!list.some((entry: { id: number }) => entry.id === uploaded.id));
    assert.equal(
        (await get(app, other, `/api/materials/${prepared.id}`)).statusCode,
        200,
    );
    assert.equal(
        (await get(app, other, `/api/materials/${uploaded.id}`)).statusCode,
        404,
    );
    assert.equal(
        (await get(app, other, `/api/materials/${uploaded.id}/pages/1`))
            .statusCode,
        404,
    );
});

test('a student or an admin cannot use the materials routes, and a visitor must log in', async (t) => {
    const app = await testApp(t);
    const student = await createStudent(app);
    const admin = await createUser(app, 'admin');

    for (const token of [
        await loginAs(app, student.username, TEST_STUDENT_PASSWORD),
        await loginAs(app, admin.username),
    ]) {
        assert.equal((await get(app, token, '/api/materials')).statusCode, 403);
        assert.equal(
            (await upload(app, token, pdfOf(fractions))).statusCode,
            403,
        );
    }

    const visitor = await app.inject({ method: 'GET', url: '/api/materials' });
    assert.equal(visitor.statusCode, 401);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    asStudent,
    demoClass,
    demoStudent,
    takeDemo,
} from './demo-attempts.ts';
import { TEST_ORIGIN, testApp } from './helpers.ts';

test("a student collects a mission's card, its reflection's takeaways, when they submit it, and the chapter's sticker once every mission in it is submitted", async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const before = await asStudent(app, student.token, 'GET', '/cards');

    await takeDemo(app, student.token, assignmentId);

    const after = await asStudent(app, student.token, 'GET', '/cards');
    const teacher = await app.inject({
        method: 'GET',
        url: '/api/student/cards',
        headers: { origin: TEST_ORIGIN },
        cookies: { session: teacherToken },
    });

    assert.equal(before.statusCode, 200);
    assert.deepEqual(before.json(), { cards: [], stickers: [] });
    assert.equal(after.statusCode, 200);
    assert.deepEqual(
        after
            .json()
            .cards.map(
                ({
                    id,
                    title,
                    chapter,
                    subject,
                    takeaways,
                }: Record<string, unknown>) => ({
                    id,
                    title,
                    chapter,
                    subject,
                    takeaways,
                }),
            ),
        [
            {
                id: assignmentId,
                title: 'Pecahan: bagian yang sama besar',
                chapter: 'Mengenal pecahan',
                subject: 'mathematics',
                takeaways: [
                    '1/4 artinya 1 dari 4 bagian yang sama besar.',
                    'Potongan yang tidak sama besar bukan seperempat.',
                ],
            },
        ],
    );
    assert.deepEqual(
        after
            .json()
            .stickers.map(({ title, subject }: Record<string, unknown>) => ({
                title,
                subject,
            })),
        [{ title: 'Mengenal pecahan', subject: 'mathematics' }],
    );
    assert.equal(teacher.statusCode, 403);
});

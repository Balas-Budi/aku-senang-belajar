import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asc, eq } from 'drizzle-orm';
import {
    competencies,
    learningSessions,
    materials,
    modules,
    sessionCompetencies,
} from '../src/db/schema.ts';
import { mathsBook } from '../src/learning/maths-book.ts';
import { seedBook } from '../src/learning/seed-book.ts';
import { testApp } from './helpers.ts';

test('the sample maths book lands once in the shared library, with three ready stages in its first chapter, each teaching its own competencies', async (t) => {
    const app = await testApp(t);

    await seedBook(app.db, mathsBook);
    const again = await seedBook(app.db, mathsBook);
    const books = await app.db
        .select({ id: materials.id, ownerId: materials.ownerId })
        .from(materials)
        .where(eq(materials.title, mathsBook.material));
    const chapters = await app.db
        .select({ id: modules.id, title: modules.title })
        .from(modules)
        .where(eq(modules.materialId, books[0].id))
        .orderBy(asc(modules.id));
    const stages = await app.db
        .select({
            title: learningSessions.title,
            status: learningSessions.status,
        })
        .from(learningSessions)
        .where(eq(learningSessions.moduleId, chapters[0].id))
        .orderBy(asc(learningSessions.id));
    const taught = await app.db
        .select({ sessionId: learningSessions.id, code: competencies.code })
        .from(sessionCompetencies)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, sessionCompetencies.learningSessionId),
        )
        .innerJoin(
            competencies,
            eq(competencies.id, sessionCompetencies.competencyId),
        )
        .where(eq(learningSessions.moduleId, chapters[0].id))
        .orderBy(asc(learningSessions.id), asc(competencies.code));
    const codesOf = [...new Set(taught.map(({ sessionId }) => sessionId))].map(
        (id) =>
            taught
                .filter(({ sessionId }) => sessionId === id)
                .map(({ code }) => code),
    );

    assert.equal(again.created, false);
    assert.deepEqual(books, [{ id: books[0].id, ownerId: null }]);
    assert.deepEqual(
        chapters.map(({ title }) => title),
        ['Mengenal pecahan', 'Pecahan senilai'],
    );
    assert.deepEqual(stages, [
        { title: 'Pecahan: bagian yang sama besar', status: 'ready' },
        { title: 'Pembilang dan penyebut', status: 'ready' },
        { title: 'Potongan mana yang lebih besar?', status: 'ready' },
    ]);
    assert.deepEqual(codesOf, [['C1', 'C2', 'C3'], ['C4'], ['C5']]);
});

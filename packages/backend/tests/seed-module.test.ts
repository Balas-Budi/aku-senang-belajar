import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    assignments,
    blockCompetencies,
    competencies,
    learningSessions,
    materials,
    sessionBlocks,
} from '../src/db/schema.ts';
import { demoModule } from '../src/learning/demo-module.ts';
import { seedModule } from '../src/learning/seed-module.ts';
import { createClass, createUser, loginAs, testApp } from './helpers.ts';

async function newClass(app: FastifyInstance) {
    const teacher = await createUser(app);

    return createClass(app, await loginAs(app, teacher.username));
}

function freshCopy() {
    return { ...demoModule, material: `Demo module ${randomUUID()}` };
}

function rubricsOf(app: FastifyInstance, sessionId: number) {
    return app.db
        .select({ code: competencies.code, rubric: competencies.rubric })
        .from(competencies)
        .innerJoin(
            learningSessions,
            eq(learningSessions.moduleId, competencies.moduleId),
        )
        .where(eq(learningSessions.id, sessionId))
        .orderBy(asc(competencies.code));
}

test('seeding a prepared module stores one ready session with its blocks and their competencies', async (t) => {
    const app = await testApp(t);
    const classroom = await newClass(app);

    const { sessionId } = await seedModule(app.db, classroom.id, freshCopy());

    const session = await app.db
        .select({
            title: learningSessions.title,
            status: learningSessions.status,
        })
        .from(learningSessions)
        .where(eq(learningSessions.id, sessionId));
    const blocks = await app.db
        .select({ kind: sessionBlocks.kind, content: sessionBlocks.content })
        .from(sessionBlocks)
        .where(eq(sessionBlocks.learningSessionId, sessionId))
        .orderBy(asc(sessionBlocks.position));
    const links = await app.db
        .select({ position: sessionBlocks.position, code: competencies.code })
        .from(blockCompetencies)
        .innerJoin(
            sessionBlocks,
            eq(sessionBlocks.id, blockCompetencies.blockId),
        )
        .innerJoin(
            competencies,
            eq(competencies.id, blockCompetencies.competencyId),
        )
        .where(eq(sessionBlocks.learningSessionId, sessionId))
        .orderBy(asc(sessionBlocks.position), asc(competencies.code));

    assert.deepEqual(session, [
        { title: demoModule.session.title, status: 'ready' },
    ]);
    assert.deepEqual(
        blocks,
        demoModule.blocks.map(({ kind, content }) => ({ kind, content })),
    );
    assert.deepEqual(
        links,
        demoModule.blocks.flatMap((block, index) =>
            block.competencies.map((code) => ({ position: index + 1, code })),
        ),
    );
    assert.deepEqual(
        await rubricsOf(app, sessionId),
        demoModule.competencies.map(({ code, rubric }) => ({ code, rubric })),
    );
});

test('seeding again refreshes the competency rubrics and leaves the session as it was', async (t) => {
    const app = await testApp(t);
    const classroom = await newClass(app);
    const prepared = freshCopy();
    const revisedRubric = {
        visible: ['Revised visible.'],
        developing: ['Revised developing.'],
        notEnough: ['Revised not enough.'],
    };

    const { sessionId } = await seedModule(app.db, classroom.id, prepared);
    const again = await seedModule(app.db, classroom.id, {
        ...prepared,
        competencies: prepared.competencies.map((competency) =>
            competency.code === 'C1'
                ? { ...competency, rubric: revisedRubric }
                : competency,
        ),
        blocks: prepared.blocks.slice(0, 2),
    });

    const blocks = await app.db
        .select({ id: sessionBlocks.id })
        .from(sessionBlocks)
        .where(eq(sessionBlocks.learningSessionId, sessionId));

    assert.equal(again.sessionId, sessionId);
    assert.equal(blocks.length, demoModule.blocks.length);
    assert.deepEqual(
        await rubricsOf(app, sessionId),
        demoModule.competencies.map(({ code, rubric }) => ({
            code,
            rubric: code === 'C1' ? revisedRubric : rubric,
        })),
    );
});

test('a rubric without indicators is refused before anything is stored', async (t) => {
    const app = await testApp(t);
    const classroom = await newClass(app);
    const prepared = freshCopy();

    await assert.rejects(
        seedModule(app.db, classroom.id, {
            ...prepared,
            competencies: prepared.competencies.map((competency) => ({
                ...competency,
                rubric: {
                    visible: [],
                    developing: ['Developing.'],
                    notEnough: ['Not enough.'],
                },
            })),
        }),
    );

    const stored = await app.db
        .select({ id: materials.id })
        .from(materials)
        .where(eq(materials.title, prepared.material));

    assert.deepEqual(stored, []);
});

test('seeding again reuses the session and assigns it once per class', async (t) => {
    const app = await testApp(t);
    const first = await newClass(app);
    const second = await newClass(app);
    const prepared = freshCopy();

    const seeded = await seedModule(app.db, first.id, prepared);
    const again = await seedModule(app.db, first.id, prepared);
    const forSecond = await seedModule(app.db, second.id, prepared);

    const assigned = await app.db
        .select({ classId: assignments.classId })
        .from(assignments)
        .where(eq(assignments.learningSessionId, seeded.sessionId))
        .orderBy(asc(assignments.classId));

    assert.equal(seeded.assigned, true);
    assert.deepEqual(again, { sessionId: seeded.sessionId, assigned: false });
    assert.deepEqual(forSecond, {
        sessionId: seeded.sessionId,
        assigned: true,
    });
    assert.deepEqual(assigned, [{ classId: first.id }, { classId: second.id }]);
});

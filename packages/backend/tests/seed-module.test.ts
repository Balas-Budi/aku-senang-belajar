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

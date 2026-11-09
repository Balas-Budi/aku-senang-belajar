import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { analysisRuns, attempts } from '../src/db/schema.ts';
import { summaryMessage } from '../src/memory/summaries.ts';
import { stubProvider } from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    runFor,
    takeDemo,
    verdicts,
} from './demo-attempts.ts';
import { TEST_ORIGIN, testApp } from './helpers.ts';

const defaults = { textSize: 'normal', readAloud: false, speechRate: 1 };

function settings(app: FastifyInstance, token: string, payload?: object) {
    return app.inject({
        method: payload ? 'PUT' : 'GET',
        url: '/api/student/settings',
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload,
    });
}

async function readAloudOf(app: FastifyInstance, attemptId: number) {
    const [attempt] = await app.db
        .select({ readAloud: attempts.readAloud })
        .from(attempts)
        .where(eq(attempts.id, attemptId));

    return attempt?.readAloud;
}

test("a student's settings start at the defaults, are saved whole, and stay their own", async (t) => {
    const app = await testApp(t);
    const { teacherToken, classId } = await demoClass(app);
    const wulan = await demoStudent(app, classId, 'Wulan Sari');
    const budi = await demoStudent(app, classId, 'Budi');
    const chosen = { textSize: 'larger', readAloud: true, speechRate: 0.75 };

    assert.deepEqual((await settings(app, wulan.token)).json(), defaults);

    const saved = await settings(app, wulan.token, chosen);

    assert.equal(saved.statusCode, 200);
    assert.deepEqual(saved.json(), chosen);
    assert.deepEqual((await settings(app, wulan.token)).json(), chosen);
    assert.deepEqual((await settings(app, budi.token)).json(), defaults);

    for (const wrong of [
        { ...chosen, speechRate: 2 },
        { ...chosen, textSize: 'huge' },
        { textSize: 'large' },
    ]) {
        assert.equal((await settings(app, wulan.token, wrong)).statusCode, 400);
    }

    assert.equal((await settings(app, teacherToken)).statusCode, 403);
});

test('listening to a question is help before its try, the attempt keeps whether screens were read aloud, and the analysis sees neither', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId } = await demoClass(app);
    const wulan = await demoStudent(app, classId, 'Wulan Sari');
    const budi = await demoStudent(app, classId, 'Budi');

    await settings(app, wulan.token, { ...defaults, readAloud: true });

    const detail: { blocks: { id: number; kind: string }[] } = (
        await asStudent(app, wulan.token, 'GET', `/assignments/${assignmentId}`)
    ).json();
    const attempt: { id: number } = (
        await asStudent(
            app,
            wulan.token,
            'POST',
            `/assignments/${assignmentId}/attempt`,
        )
    ).json();
    const blockOf = (kind: string) =>
        detail.blocks.find((block) => block.kind === kind)?.id ?? 0;
    const listen = (blockId: number) =>
        asStudent(app, wulan.token, 'POST', `/attempts/${attempt.id}/help`, {
            blockId,
            kind: 'listen',
        });

    assert.equal((await listen(blockOf('check'))).statusCode, 201);
    assert.equal((await listen(blockOf('challenge'))).statusCode, 201);
    assert.equal((await listen(blockOf('story'))).statusCode, 400);
    assert.equal(await takeDemo(app, wulan.token, assignmentId), attempt.id);
    assert.equal(await readAloudOf(app, attempt.id), true);

    const provider = await stubProvider(t, [verdicts()]);

    await runFor(app, attempt.id, provider.config);
    assert.equal(
        provider.requests[0]?.text.includes('listen'),
        false,
        'the analysis does not count listening as help',
    );

    const [run] = await app.db
        .select({ id: analysisRuns.id })
        .from(analysisRuns)
        .where(eq(analysisRuns.attemptId, attempt.id));

    assert.ok(run);

    const sent: {
        readAloud: boolean;
        competencies: {
            questions: { tries: { helpBefore: string[] }[] }[];
        }[];
    } = JSON.parse(await summaryMessage(app.db, run.id));

    assert.equal(sent.readAloud, true);
    assert.ok(
        sent.competencies
            .flatMap(({ questions }) => questions)
            .some(({ tries }) => tries[0]?.helpBefore.includes('listen')),
        'the summary sees listening before a first try',
    );

    const started: { id: number } = (
        await asStudent(
            app,
            budi.token,
            'POST',
            `/assignments/${assignmentId}/attempt`,
        )
    ).json();

    assert.equal(await readAloudOf(app, started.id), false);
    await settings(app, budi.token, { ...defaults, readAloud: true });
    assert.equal(
        await readAloudOf(app, started.id),
        true,
        'turning reading aloud on marks the mission in progress',
    );
});

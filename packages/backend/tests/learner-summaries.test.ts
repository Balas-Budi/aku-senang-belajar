import assert from 'node:assert/strict';
import { test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { startAnalysisRunner } from '../src/analysis/runner.ts';
import { buildApp } from '../src/app.ts';
import {
    analysisRuns,
    helpEvents,
    learnerSummaries,
    responses,
} from '../src/db/schema.ts';
import {
    claimSummary,
    MAX_SUMMARY_TRIES,
    processSummary,
    queueMissingSummaries,
    retryFailedSummaries,
    SUMMARY_PROMPT,
    SUMMARY_PROMPT_VERSION,
} from '../src/memory/summaries.ts';
import { basis, completion, stubEmbedder, stubProvider } from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    drawnDemoModule,
    drawnLabel,
    runFor,
    takeDemo,
    verdicts,
} from './demo-attempts.ts';
import { testApp, testEnv } from './helpers.ts';

const written =
    'C2 benar setelah satu petunjuk: siswa lalu menjelaskan bahwa potongannya harus sama besar.';
const summaryReply = { body: completion(JSON.stringify({ summary: written })) };

const sentSummary = z.object({
    competencies: z.array(
        z.object({
            code: z.string(),
            estimate: z.object({ status: z.string() }),
            questions: z.array(
                z.object({
                    tries: z.array(
                        z.object({ helpBefore: z.array(z.string()) }),
                    ),
                    helpAfter: z.array(z.string()),
                }),
            ),
        }),
    ),
});

const sentDiagrams = z.object({
    competencies: z.array(
        z.object({
            code: z.string(),
            questions: z.array(
                z.object({
                    diagram: z.string().optional(),
                    helpDiagrams: z.array(z.string()).optional(),
                }),
            ),
        }),
    ),
});

async function submittedDemo(app: FastifyInstance) {
    const { teacher, classId, assignmentId } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const attemptId = await takeDemo(app, student.token, assignmentId);

    return { attemptId, student, teacher };
}

function summaryOf(app: FastifyInstance, attemptId: number) {
    return app.db
        .select({
            id: learnerSummaries.id,
            text: learnerSummaries.text,
            model: learnerSummaries.model,
            promptVersion: learnerSummaries.promptVersion,
            embedding: learnerSummaries.embedding,
            tries: learnerSummaries.tries,
            runAfter: learnerSummaries.runAfter,
            writtenAt: learnerSummaries.writtenAt,
            embeddedAt: learnerSummaries.embeddedAt,
        })
        .from(learnerSummaries)
        .innerJoin(analysisRuns, eq(analysisRuns.id, learnerSummaries.runId))
        .where(eq(analysisRuns.attemptId, attemptId));
}

test('an analysed mission queues one summary, written from the estimates and the help before each try, without the student or the class', async (t) => {
    const app = await testApp(t);
    const { attemptId, student, teacher } = await submittedDemo(app);
    const tried = await app.db
        .select({
            id: responses.id,
            blockId: responses.blockId,
            tryNumber: responses.tryNumber,
        })
        .from(responses)
        .where(eq(responses.attemptId, attemptId));
    const second = tried.find(({ tryNumber }) => tryNumber === 2);

    assert.ok(second, 'the demo answers one question twice');

    const first = tried.find(
        ({ blockId, tryNumber }) =>
            blockId === second.blockId && tryNumber === 1,
    );
    const start = Date.now() - 60_000;

    assert.ok(first);
    await app.db
        .update(responses)
        .set({ createdAt: new Date(start) })
        .where(eq(responses.id, first.id));
    assert.deepEqual(
        await app.db
            .update(helpEvents)
            .set({ createdAt: new Date(start) })
            .where(
                and(
                    eq(helpEvents.attemptId, attemptId),
                    eq(helpEvents.blockId, second.blockId),
                ),
            )
            .returning({ kind: helpEvents.kind }),
        [{ kind: 'hint' }],
        'the wrong first try earned a hint, stored with that try',
    );
    await app.db
        .update(responses)
        .set({ createdAt: new Date(start + 2_000) })
        .where(eq(responses.id, second.id));
    await app.db.insert(helpEvents).values([
        {
            attemptId,
            blockId: second.blockId,
            kind: 'example',
            createdAt: new Date(start + 1_000),
        },
        {
            attemptId,
            blockId: second.blockId,
            kind: 'reveal',
            createdAt: new Date(start + 3_000),
        },
    ]);

    const provider = await stubProvider(t, [verdicts(), summaryReply]);

    await runFor(app, attemptId, provider.config);

    assert.deepEqual(
        (await summaryOf(app, attemptId)).map(({ text }) => text),
        [null],
    );

    const claimed = await claimSummary(app.db, { embedding: false, attemptId });

    assert.ok(claimed);
    await processSummary(app, claimed, provider.config, null);

    const [summary] = await summaryOf(app, attemptId);
    const request = provider.requests[1];

    assert.ok(request);
    assert.equal(summary?.text, written);
    assert.equal(summary?.model, 'provider-model-name');
    assert.equal(summary?.promptVersion, SUMMARY_PROMPT_VERSION);
    assert.ok(summary?.writtenAt);
    assert.equal(summary?.embedding, null);
    assert.equal(request.body.messages[0]?.content, SUMMARY_PROMPT);

    const sent = sentSummary.parse(
        JSON.parse(request.body.messages[1]?.content ?? ''),
    );
    const retried = sent.competencies
        .flatMap(({ questions }) => questions)
        .find(({ tries }) => tries.length === 2);

    assert.deepEqual(
        sent.competencies.map(({ code, estimate }) => [code, estimate.status]),
        [
            ['C1', 'visible'],
            ['C2', 'visible'],
            ['C3', 'visible'],
        ],
    );
    assert.ok(retried);
    assert.deepEqual(
        retried.tries.map(({ helpBefore }) => helpBefore),
        [[], ['hint', 'example']],
    );
    assert.deepEqual(retried.helpAfter, ['reveal']);

    for (const withheld of [
        'Wulan',
        student.username,
        teacher.username,
        'Kelas 4A',
    ]) {
        assert.equal(
            request.text.includes(withheld),
            false,
            `the model received ${withheld}`,
        );
    }

    assert.equal(
        await claimSummary(app.db, { embedding: false, attemptId }),
        null,
    );
});

test('a mission without answers to judge gets no summary', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId } = await demoClass(app);
    const { token } = await demoStudent(app, classId);
    const attempt: { id: number } = (
        await asStudent(
            app,
            token,
            'POST',
            `/assignments/${assignmentId}/attempt`,
        )
    ).json();

    await asStudent(app, token, 'POST', `/attempts/${attempt.id}/submit`);
    await runFor(app, attempt.id, null);

    assert.deepEqual(await summaryOf(app, attempt.id), []);
    assert.equal(
        await queueMissingSummaries(app.db, { attemptId: attempt.id }),
        0,
    );
});

test('a summary that keeps failing waits a minute, then five, stops after three tries, and starts again once retried', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app);
    const provider = await stubProvider(t, [
        verdicts(),
        { status: 503 },
        { status: 503 },
        { status: 503 },
    ]);

    await runFor(app, attemptId, provider.config);

    const [queued] = await summaryOf(app, attemptId);

    assert.ok(queued);

    const due = () =>
        app.db
            .update(learnerSummaries)
            .set({ runAfter: new Date(0) })
            .where(eq(learnerSummaries.id, queued.id));
    const write = async () => {
        const claimed = await claimSummary(app.db, {
            embedding: false,
            attemptId,
        });

        assert.ok(claimed, 'the summary is due');
        await processSummary(app, claimed, provider.config, null);

        return (await summaryOf(app, attemptId))[0];
    };
    const started = Date.now();
    let summary = await write();

    assert.equal(summary?.tries, 1);
    assert.equal(summary?.text, null);
    assert.ok((summary?.runAfter.getTime() ?? 0) >= started + 59_000);
    assert.equal(
        await claimSummary(app.db, { embedding: false, attemptId }),
        null,
    );

    await due();
    summary = await write();
    assert.equal(summary?.tries, 2);
    assert.ok((summary?.runAfter.getTime() ?? 0) >= Date.now() + 4 * 60_000);

    await due();
    summary = await write();
    assert.equal(summary?.tries, MAX_SUMMARY_TRIES);

    await due();
    assert.equal(
        await claimSummary(app.db, { embedding: false, attemptId }),
        null,
    );
    assert.equal(provider.requests.length, 1 + MAX_SUMMARY_TRIES);
    assert.equal(await retryFailedSummaries(app.db, { attemptId }), 1);
    assert.ok(await claimSummary(app.db, { embedding: false, attemptId }));
});

test('a summary written before embeddings were set is embedded once they are, without writing it again', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app);
    const provider = await stubProvider(t, [verdicts(), summaryReply]);
    const embedder = await stubEmbedder(t, (texts) => ({
        vectors: texts.map((_, index) => basis(index)),
    }));

    await runFor(app, attemptId, provider.config);

    const first = await claimSummary(app.db, { embedding: false, attemptId });

    assert.ok(first);
    await processSummary(app, first, provider.config, null);
    assert.equal((await summaryOf(app, attemptId))[0]?.embedding, null);

    const later = await claimSummary(app.db, { embedding: true, attemptId });

    assert.ok(later);
    await processSummary(app, later, provider.config, embedder.config);

    const [summary] = await summaryOf(app, attemptId);

    assert.equal(provider.requests.length, 2);
    assert.deepEqual(embedder.requests[0]?.body.input, [written]);
    assert.equal(summary?.embedding?.[0], 1);
    assert.ok(summary?.embeddedAt);
    assert.equal(
        await claimSummary(app.db, { embedding: true, attemptId }),
        null,
    );
});

test('the runner started with the server writes and embeds the summary after the analysis', async (t) => {
    const viewer = await testApp(t);
    const { attemptId } = await submittedDemo(viewer);
    const provider = await stubProvider(t, [verdicts(), summaryReply]);
    const embedder = await stubEmbedder(t, (texts) => ({
        vectors: texts.map((_, index) => basis(index)),
    }));
    const app = await buildApp({
        ...testEnv(provider.config),
        AI_EMBED_BASE_URL: embedder.config.baseUrl,
        AI_EMBED_API_KEY: embedder.config.apiKey,
        AI_EMBED_MODEL: embedder.config.model,
    });

    t.after(() => app.close());
    startAnalysisRunner(app, { everyMs: 20, attemptId });
    await app.ready();

    const deadline = Date.now() + 5_000;

    while (!(await summaryOf(viewer, attemptId))[0]?.embeddedAt) {
        assert.ok(Date.now() < deadline, 'the runner did not get there');
        await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const [summary] = await summaryOf(viewer, attemptId);

    assert.equal(summary?.text, written);
    assert.equal(summary?.tries, 1);
});

test('summarise-attempts queues a summary for a mission analysed before learner memory, once', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app);
    const provider = await stubProvider(t, [verdicts()]);

    await runFor(app, attemptId, provider.config);

    const [queued] = await summaryOf(app, attemptId);

    assert.ok(queued);
    await app.db
        .delete(learnerSummaries)
        .where(eq(learnerSummaries.id, queued.id));
    assert.equal(await queueMissingSummaries(app.db, { attemptId }), 1);
    assert.equal(await queueMissingSummaries(app.db, { attemptId }), 0);
    assert.equal((await summaryOf(app, attemptId)).length, 1);
});

test('the summary request names the diagram of each question and the diagrams of the help opened', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId } = await demoClass(
        app,
        false,
        drawnDemoModule,
    );
    const attemptId = await takeDemo(
        app,
        (await demoStudent(app, classId)).token,
        assignmentId,
    );
    const provider = await stubProvider(t, [verdicts(), summaryReply]);

    await runFor(app, attemptId, provider.config);

    const claimed = await claimSummary(app.db, { embedding: false, attemptId });

    assert.ok(claimed);
    await processSummary(app, claimed, provider.config, null);

    const request = provider.requests[1];

    assert.ok(request);

    const sent = sentDiagrams.parse(
        JSON.parse(request.body.messages[1]?.content ?? ''),
    );

    assert.deepEqual(
        sent.competencies.map(({ code, questions }) => [
            code,
            questions.map(({ diagram, helpDiagrams }) => [
                diagram,
                helpDiagrams,
            ]),
        ]),
        [
            ['C1', [[drawnLabel('soal', 6), undefined]]],
            [
                'C2',
                [
                    [drawnLabel('soal', 4), [drawnLabel('petunjuk 1', 4)]],
                    [drawnLabel('tantangan', 7), undefined],
                ],
            ],
            ['C3', [[drawnLabel('tantangan', 7), undefined]]],
        ],
    );
    assert.match(SUMMARY_PROMPT, /"helpDiagrams" the labels of the pictures/);
    assert.equal(SUMMARY_PROMPT_VERSION, 'summary-2026-11-10');
});

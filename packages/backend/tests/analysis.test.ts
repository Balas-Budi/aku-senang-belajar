import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PROMPT_VERSION } from '../src/analysis/prompt.ts';
import { startAnalysisRunner } from '../src/analysis/runner.ts';
import { buildApp } from '../src/app.ts';
import {
    analysisRuns,
    assessments,
    competencies,
    responses,
} from '../src/db/schema.ts';
import { stubProvider } from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    refsOf,
    runFor,
    sentEvidence,
    takeDemo,
    verdicts,
} from './demo-attempts.ts';
import { testApp, testEnv } from './helpers.ts';

const refList = z.array(z.int());

async function submittedDemo(app: FastifyInstance, extraCompetency = false) {
    const { teacher, classId, assignmentId } = await demoClass(
        app,
        extraCompetency,
    );
    const student = await demoStudent(app, classId);
    const attemptId = await takeDemo(app, student.token, assignmentId);

    return { attemptId, student, teacher, token: student.token };
}

function runsOf(app: FastifyInstance, attemptId: number) {
    return app.db
        .select()
        .from(analysisRuns)
        .where(eq(analysisRuns.attemptId, attemptId))
        .orderBy(asc(analysisRuns.id));
}

function assessmentsOf(app: FastifyInstance, attemptId: number) {
    return app.db
        .select({
            code: competencies.code,
            status: assessments.status,
            reason: assessments.reason,
            uncertainty: assessments.uncertainty,
            flags: assessments.flags,
            evidence: assessments.evidence,
            followUps: assessments.followUps,
        })
        .from(assessments)
        .innerJoin(analysisRuns, eq(analysisRuns.id, assessments.runId))
        .innerJoin(competencies, eq(competencies.id, assessments.competencyId))
        .where(eq(analysisRuns.attemptId, attemptId))
        .orderBy(asc(competencies.code));
}

async function until(reached: () => Promise<boolean>) {
    const deadline = Date.now() + 5_000;

    while (!(await reached())) {
        assert.ok(
            Date.now() < deadline,
            'the runner did not get there in time',
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

test('submitting queues one analysis run, and submitting again queues no second one', async (t) => {
    const app = await testApp(t);
    const { attemptId, token } = await submittedDemo(app);

    await asStudent(app, token, 'POST', `/attempts/${attemptId}/submit`);

    const runs = await runsOf(app, attemptId);

    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.status, 'queued');
    assert.equal(runs[0]?.tries, 0);
});

test('a run stores per competency a status, a reason, cited answers, uncertainty, and follow-up questions (FR-040, FR-041, FR-042, FR-044)', async (t) => {
    const app = await testApp(t);
    const { attemptId, student, teacher } = await submittedDemo(app);
    const provider = await stubProvider(t, [
        verdicts((competency) =>
            competency.code === 'C2'
                ? {
                      status: 'developing',
                      reason: 'Benar setelah satu percobaan yang belum tepat.',
                      evidence: refsOf(competency),
                      followUps: ['Mengapa potongan roti harus sama besar?'],
                  }
                : {},
        ),
    ]);

    await runFor(app, attemptId, provider.config);

    const [run] = await runsOf(app, attemptId);
    const stored = await assessmentsOf(app, attemptId);
    const answerIds = (
        await app.db
            .select({ id: responses.id })
            .from(responses)
            .where(eq(responses.attemptId, attemptId))
    ).map(({ id }) => id);
    const request = provider.requests[0];

    assert.ok(request);
    assert.equal(run?.status, 'succeeded');
    assert.equal(run?.model, 'provider-model-name');
    assert.equal(run?.promptVersion, PROMPT_VERSION);
    assert.equal(run?.error, null);
    assert.deepEqual(
        stored.map(({ code, status, uncertainty }) => ({
            code,
            status,
            uncertainty,
        })),
        [
            { code: 'C1', status: 'visible', uncertainty: 'medium' },
            { code: 'C2', status: 'developing', uncertainty: 'low' },
            { code: 'C3', status: 'visible', uncertainty: 'medium' },
        ],
    );
    assert.deepEqual(stored[1]?.followUps, [
        'Mengapa potongan roti harus sama besar?',
    ]);

    for (const assessment of stored) {
        const refs = refList.parse(assessment.evidence);

        assert.ok(assessment.reason.length > 0);
        assert.ok(refs.length > 0);
        assert.ok(refs.every((ref) => answerIds.includes(ref)));
    }

    const evidence = sentEvidence(request);

    assert.deepEqual(
        evidence.map(({ code, evidence: questions }) => [
            code,
            questions.map(({ kind }) => kind),
        ]),
        [
            ['C1', ['check']],
            ['C2', ['check', 'challenge']],
            ['C3', ['challenge']],
        ],
    );
    assert.ok(evidence.every(({ selfReport }) => selfReport !== null));

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
});

test('conflicting answers end as Perlu verifikasi, citing both answers (AT-09)', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app);
    const conflict = (status: string) =>
        verdicts((competency) =>
            competency.code === 'C2'
                ? {
                      status,
                      flags: ['conflicting'],
                      reason: 'Pilihan dan alasannya saling bertentangan.',
                      evidence: refsOf(competency).slice(0, 2),
                      followUps: [
                          'Coba jelaskan lagi mengapa potongan ini bukan seperempat.',
                      ],
                  }
                : {},
        );
    const provider = await stubProvider(t, [
        conflict('developing'),
        conflict('needs_verification'),
    ]);

    await runFor(app, attemptId, provider.config);

    const c2 = (await assessmentsOf(app, attemptId)).find(
        ({ code }) => code === 'C2',
    );

    assert.equal(c2?.status, 'needs_verification');
    assert.deepEqual(c2?.flags, ['conflicting']);
    assert.equal(refList.parse(c2?.evidence).length, 2);
    assert.match(
        provider.requests[1]?.body.messages.at(-1)?.content ?? '',
        /conflicting/,
    );
});

test('a citation outside the evidence is sent back for correction', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app);
    const provider = await stubProvider(t, [
        verdicts((competency) =>
            competency.code === 'C1' ? { evidence: [2_000_000_000] } : {},
        ),
        verdicts(),
    ]);

    await runFor(app, attemptId, provider.config);

    const [run] = await runsOf(app, attemptId);

    assert.equal(run?.status, 'succeeded');
    assert.match(
        provider.requests[1]?.body.messages.at(-1)?.content ?? '',
        /not in its evidence/,
    );
});

test('a mission is judged only on the competencies it teaches, not on the rest of its chapter', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app, true);
    const provider = await stubProvider(t, [verdicts()]);

    await runFor(app, attemptId, provider.config);

    const request = provider.requests[0];

    assert.ok(request);
    assert.deepEqual(
        sentEvidence(request).map(({ code }) => code),
        ['C1', 'C2', 'C3'],
    );
    assert.deepEqual(
        (await assessmentsOf(app, attemptId)).map(({ code }) => code),
        ['C1', 'C2', 'C3'],
    );
});

test('a competency the mission tests but the student left unanswered is Belum teramati without asking the model', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId } = await demoClass(app);
    const { token } = await demoStudent(app, classId);
    const provider = await stubProvider(t, []);
    const attempt: { id: number } = (
        await asStudent(
            app,
            token,
            'POST',
            `/assignments/${assignmentId}/attempt`,
        )
    ).json();

    await asStudent(app, token, 'POST', `/attempts/${attempt.id}/submit`);
    await runFor(app, attempt.id, provider.config);

    assert.equal(provider.requests.length, 0);
    assert.deepEqual(
        await assessmentsOf(app, attempt.id),
        ['C1', 'C2', 'C3'].map((code) => ({
            code,
            status: 'not_observed',
            reason: 'Belum ada jawaban soal untuk kompetensi ini.',
            uncertainty: 'high',
            flags: ['thin'],
            evidence: [],
            followUps: [],
        })),
    );
});

test('a model that keeps failing leaves the run failed after three tries, with the answers kept and no status (AT-12)', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app);
    const provider = await stubProvider(t, [
        { status: 503 },
        { status: 503 },
        { status: 503 },
    ]);
    const makeDue = () =>
        app.db
            .update(analysisRuns)
            .set({ runAfter: new Date(0) })
            .where(eq(analysisRuns.attemptId, attemptId));

    await runFor(app, attemptId, provider.config);

    const [afterFirst] = await runsOf(app, attemptId);

    assert.equal(afterFirst?.status, 'queued');
    assert.equal(afterFirst?.tries, 1);
    assert.ok((afterFirst?.runAfter.getTime() ?? 0) > Date.now());
    assert.match(afterFirst?.error ?? '', /503/);

    await makeDue();
    await runFor(app, attemptId, provider.config);
    await makeDue();
    await runFor(app, attemptId, provider.config);

    const [run] = await runsOf(app, attemptId);
    const kept = await app.db
        .select({ id: responses.id })
        .from(responses)
        .where(eq(responses.attemptId, attemptId));

    assert.equal(run?.status, 'failed');
    assert.equal(run?.tries, 3);
    assert.ok(run?.finishedAt);
    assert.equal(provider.requests.length, 3);
    assert.deepEqual(await assessmentsOf(app, attemptId), []);
    assert.equal(kept.length, 6);
});

test('a run left running by a stopped server is picked up again', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app);
    const provider = await stubProvider(t, [verdicts()]);

    await app.db
        .update(analysisRuns)
        .set({
            status: 'running',
            tries: 1,
            startedAt: new Date(Date.now() - 10 * 60_000),
        })
        .where(eq(analysisRuns.attemptId, attemptId));
    await runFor(app, attemptId, provider.config);

    const [run] = await runsOf(app, attemptId);

    assert.equal(run?.status, 'succeeded');
    assert.equal(run?.tries, 2);
});

test('without AI settings a run with answers waits for a later try', async (t) => {
    const app = await testApp(t);
    const { attemptId } = await submittedDemo(app);

    await runFor(app, attemptId, null);

    const [run] = await runsOf(app, attemptId);

    assert.equal(run?.status, 'queued');
    assert.equal(run?.tries, 1);
    assert.match(run?.error ?? '', /AI_BASE_URL/);
    assert.deepEqual(await assessmentsOf(app, attemptId), []);
});

test('the runner started with the server analyses a submitted attempt, and closing the server lets that run finish', async (t) => {
    const viewer = await testApp(t);
    const { attemptId } = await submittedDemo(viewer);
    const reply = verdicts();
    const provider = await stubProvider(t, [
        (request) => ({ ...reply(request), delay: 200 }),
    ]);
    const app = await buildApp({
        ...testEnv(),
        AI_BASE_URL: provider.config.baseUrl,
        AI_API_KEY: provider.config.apiKey,
        AI_MODEL: provider.config.model,
    });
    let open = true;

    t.after(() => (open ? app.close() : undefined));
    startAnalysisRunner(app, { everyMs: 20, attemptId });
    await app.ready();
    await until(
        async () => (await runsOf(viewer, attemptId))[0]?.status === 'running',
    );
    await app.close();
    open = false;

    const [run] = await runsOf(viewer, attemptId);

    assert.equal(run?.status, 'succeeded');
    assert.equal(provider.requests.length, 1);
    assert.equal((await assessmentsOf(viewer, attemptId)).length, 3);
});

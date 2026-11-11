import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    analysisRuns,
    assessments,
    assignments,
    competencies,
    learnerAdaptations,
    responses,
    reviewTries,
    sessionBlocks,
} from '../src/db/schema.ts';
import { sessionBlock, themeProblems } from '../src/learning/blocks.ts';
import { demoModule } from '../src/learning/demo-module.ts';
import {
    type PreparedModule,
    seedModule,
} from '../src/learning/seed-module.ts';
import { summaryMessage } from '../src/memory/summaries.ts';
import {
    checkDraft,
    SESSION_PROMPT_VERSION,
    SESSION_SYSTEM_PROMPT,
    sessionDraft,
} from '../src/studio/session-draft.ts';
import { completion, stubProvider } from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    refsOf,
    runFor,
    seedTheme,
    takeDemo,
    verdicts,
    withInterests,
} from './demo-attempts.ts';
import { createUser, loginAs, TEST_ORIGIN, testApp } from './helpers.ts';
import {
    draft,
    draftedSession,
    get,
    post,
    teacherWithModule,
} from './studio-fixtures.ts';

const EXTRA_PROMPT =
    'Soal tambahan: di pasar ada tiga kue bundar. Pilih kue yang tiap potongnya seperempat.';

type Block = PreparedModule['blocks'][number];
type CheckBlock = Extract<Block, { kind: 'check' }>;

const lastCheck = demoModule.blocks
    .filter((block): block is CheckBlock => block.kind === 'check')
    .at(-1);

assert.ok(lastCheck, 'the demo has a check');

const extraModule: PreparedModule = {
    ...demoModule,
    blocks: [
        ...demoModule.blocks,
        {
            kind: 'extra_challenge',
            content: { ...lastCheck.content, prompt: EXTRA_PROMPT },
            competencies: ['C1'],
        },
    ],
};
const right = lastCheck.content.answer;
const wrong = lastCheck.content.options?.find(({ id }) => id !== right)?.id;

assert.ok(wrong);

function judged(status: (code: string) => string) {
    return verdicts((competency) => {
        const chosen = status(competency.code);

        return chosen === 'visible'
            ? {}
            : {
                  status: chosen,
                  evidence: chosen === 'not_observed' ? [] : refsOf(competency),
                  followUps: ['Bagian mana yang sama besar?'],
              };
    });
}

async function extraIdOf(app: FastifyInstance, sessionId: number) {
    const [row] = await app.db
        .select({ id: sessionBlocks.id })
        .from(sessionBlocks)
        .where(
            and(
                eq(sessionBlocks.learningSessionId, sessionId),
                eq(sessionBlocks.kind, 'extra_challenge'),
            ),
        );

    assert.ok(row, 'the mission has an extra challenge');

    return row.id;
}

async function takenMission(
    app: FastifyInstance,
    t: TestContext,
    status: (code: string) => string = () => 'visible',
    prepared = extraModule,
) {
    const provider = await stubProvider(t, [judged(status)]);
    const demo = await demoClass(app, false, prepared);
    const student = await demoStudent(app, demo.classId);
    const attemptId = await takeDemo(app, student.token, demo.assignmentId);

    await runFor(app, attemptId, provider.config);

    return { ...demo, student, attemptId, provider };
}

function extraFor(
    app: FastifyInstance,
    token: string,
    subject = 'mathematics',
) {
    return asStudent(app, token, 'GET', `/extra?subject=${subject}`);
}

function tryExtra(
    app: FastifyInstance,
    token: string,
    blockId: number,
    tryNumber: number,
    choice: string,
) {
    return asStudent(app, token, 'POST', '/extra/tries', {
        blockId,
        tryNumber,
        answer: { kind: 'check', choice },
    });
}

test('a drafted misi ends with exactly one extra challenge that names its competencies and never counts as testing one', () => {
    const check = checkDraft(['C1', 'C2'], [1, 3, 4]);
    const parsed = sessionDraft.parse(draft);
    const blocks = parsed.blocks;
    const extra = blocks.at(-1);
    const reflection = blocks.at(-2);

    assert.ok(extra && reflection);
    assert.equal(extra.kind, 'extra_challenge');
    assert.equal(check(parsed), null);
    assert.equal(
        check({ ...parsed, blocks: blocks.slice(0, -1) }),
        'End with exactly one "extra_challenge" block, after the reflection',
    );
    assert.equal(
        check({
            ...parsed,
            blocks: [...blocks.slice(0, -2), extra, reflection],
        }),
        'End with exactly one "extra_challenge" block, after the reflection',
    );
    assert.equal(
        check({ ...parsed, blocks: [...blocks, extra] }),
        'End with exactly one "extra_challenge" block, after the reflection',
    );
    assert.equal(
        check({ ...parsed, blocks: [...blocks.slice(0, -2), extra] }),
        'Put exactly one "reflection" block right before the extra challenge',
    );
    assert.equal(
        check({
            ...parsed,
            blocks: [...blocks.slice(0, -1), { ...extra, competencies: [] }],
        }),
        `Block ${blocks.length} (extra_challenge) must name the competency it tests`,
    );
    assert.equal(
        checkDraft(
            ['C1', 'C2', 'C3'],
            [1, 3, 4],
        )({
            ...parsed,
            blocks: [
                ...blocks.slice(0, -1),
                { ...extra, competencies: ['C3'] },
            ],
        }),
        'C3 has no check or challenge that tests it',
    );
    assert.equal(SESSION_PROMPT_VERSION, 'session-2026-11-11d');
    assert.ok(
        SESSION_SYSTEM_PROMPT.includes(
            '5. One "extra_challenge" after the reflection',
        ),
    );
    assert.match(
        SESSION_SYSTEM_PROMPT,
        /Its prompt is at most two sentences like every screen, so give the situation and the question together/,
    );
    assert.match(SESSION_SYSTEM_PROMPT, /never always "a"/);
    assert.ok(
        SESSION_SYSTEM_PROMPT.includes(
            'needs at least one check or the challenge that tests it; the extra challenge does not count.',
        ),
    );
});

test('a drafted challenge or extra challenge is a transfer question: it may not repeat a sentence of a story, a hint, or an example (FR-038)', () => {
    const check = checkDraft(['C1', 'C2'], [1, 3, 4]);
    const parsed = sessionDraft.parse(draft);
    const changed = (kind: string, content: object) => ({
        ...parsed,
        blocks: parsed.blocks.map((block) =>
            block.kind === kind
                ? { ...block, content: { ...block.content, ...content } }
                : block,
        ),
    });
    const rule =
        'a transfer question sets the idea in a new situation, so write it with another object or setting and its own words';

    assert.equal(
        check(
            changed('challenge', {
                prompt: 'Satu dari empat bagian sama besar disebut satu perempat.',
            }),
        ),
        `Block 6 (challenge): the sentence "Satu dari empat bagian sama besar disebut satu perempat." repeats block 4; ${rule}`,
    );
    assert.equal(
        check(
            changed('challenge', {
                question: 'Bandingkan potongan satu dengan yang lain.',
            }),
        ),
        `Block 6 (challenge): the sentence "Bandingkan potongan satu dengan yang lain." repeats block 3; ${rule}`,
    );
    assert.equal(
        check(
            changed('extra_challenge', {
                prompt: 'Lihat pizza ini. KUE yang dipotong empat sama besar juga perempat!',
            }),
        ),
        `Block 8 (extra_challenge): the sentence "KUE yang dipotong empat sama besar juga perempat!" repeats block 3; ${rule}`,
    );
    assert.equal(
        check(changed('challenge', { question: 'Kancil punya satu roti?' })),
        null,
    );
    assert.match(
        SESSION_SYSTEM_PROMPT,
        /The challenge and the extra challenge are transfer questions/,
    );
    assert.match(
        SESSION_SYSTEM_PROMPT,
        /neither asks with the same numbers and the same options as a check/,
    );
});

test('the gate warns when the challenge asks with the numbers and options of a check, and publishing needs it acknowledged (FR-038)', async (t) => {
    const repeating = {
        ...draft,
        blocks: draft.blocks.map((block) =>
            block.kind === 'challenge'
                ? {
                      ...block,
                      content: {
                          ...block.content,
                          question: 'Roti mana yang benar?',
                          options: [
                              { id: 'a', label: 'Roti A' },
                              { id: 'b', label: 'Roti B' },
                          ],
                      },
                  }
                : block,
        ),
    };
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(repeating)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    const url = `/api/studio/sessions/${session.id}`;
    const review = (await get(app, token, url)).json();
    const position =
        session.blocks.findIndex(
            ({ kind }: { kind: string }) => kind === 'challenge',
        ) + 1;

    assert.deepEqual(review.issues, []);
    assert.deepEqual(review.warnings, [
        { code: 'unreadable_pages', pages: [2] },
        { code: 'repeats_example', blocks: [position] },
    ]);

    const refused = await post(app, token, `${url}/approval`, {
        acknowledged: ['unreadable_pages'],
        version: review.version,
    });

    assert.equal(refused.statusCode, 409);
    assert.equal(refused.json().name, 'WARNINGS_NOT_ACKNOWLEDGED');

    const approved = await post(app, token, `${url}/approval`, {
        acknowledged: ['unreadable_pages', 'repeats_example'],
        version: review.version,
    });

    assert.equal(approved.statusCode, 200);
});

test('the mission never shows or takes the extra challenge, and the analysis and the summary never see it', async (t) => {
    const app = await testApp(t);
    const provider = await stubProvider(t, [judged(() => 'visible')]);
    const demo = await demoClass(app, false, extraModule);
    const student = await demoStudent(app, demo.classId);
    const extraId = await extraIdOf(app, demo.sessionId);
    const attempt = (
        await asStudent(
            app,
            student.token,
            'POST',
            `/assignments/${demo.assignmentId}/attempt`,
        )
    ).json();
    const detail = await asStudent(
        app,
        student.token,
        'GET',
        `/assignments/${demo.assignmentId}`,
    );
    const refused = [
        await app.inject({
            method: 'PUT',
            url: `/api/student/attempts/${attempt.id}/checkpoint`,
            headers: { origin: TEST_ORIGIN },
            cookies: { session: student.token },
            payload: { blockId: extraId },
        }),
        await asStudent(
            app,
            student.token,
            'POST',
            `/attempts/${attempt.id}/responses`,
            {
                blockId: extraId,
                tryNumber: 1,
                answer: { kind: 'check', choice: right },
            },
        ),
        await asStudent(
            app,
            student.token,
            'POST',
            `/attempts/${attempt.id}/help`,
            { blockId: extraId, kind: 'hint' },
        ),
    ];

    assert.equal(detail.statusCode, 200);
    assert.equal(
        detail.json().blocks.some(({ id }: { id: number }) => id === extraId),
        false,
    );
    assert.equal(detail.body.includes(EXTRA_PROMPT), false);
    assert.deepEqual(
        refused.map((response) => [
            response.statusCode,
            response.json().details[0].field,
        ]),
        [
            [400, 'blockId'],
            [400, 'blockId'],
            [400, 'blockId'],
        ],
    );

    const attemptId = await takeDemo(app, student.token, demo.assignmentId);

    await runFor(app, attemptId, provider.config);

    const [run] = await app.db
        .select({ id: analysisRuns.id, status: analysisRuns.status })
        .from(analysisRuns)
        .where(eq(analysisRuns.attemptId, attemptId));

    assert.ok(run);
    assert.equal(run.status, 'succeeded');
    assert.equal(provider.requests.length, 1);
    assert.equal(provider.requests[0]?.text.includes('Soal tambahan'), false);
    assert.equal(
        (await summaryMessage(app.db, run.id)).includes('Soal tambahan'),
        false,
    );
});

test('GET /extra offers the extra challenge only once every competency of its mission shows Terlihat, without its answer', async (t) => {
    const app = await testApp(t);
    const { student, sessionId, attemptId, teacherToken } = await takenMission(
        app,
        t,
        (code) => (code === 'C2' ? 'developing' : 'visible'),
    );
    const extraId = await extraIdOf(app, sessionId);

    assert.deepEqual((await extraFor(app, student.token)).json(), {
        extra: null,
    });

    const [estimate] = await app.db
        .select({ id: assessments.id })
        .from(assessments)
        .innerJoin(analysisRuns, eq(analysisRuns.id, assessments.runId))
        .innerJoin(competencies, eq(competencies.id, assessments.competencyId))
        .where(
            and(
                eq(analysisRuns.attemptId, attemptId),
                eq(competencies.code, 'C2'),
            ),
        );

    assert.ok(estimate);
    assert.equal(
        (
            await app.inject({
                method: 'POST',
                url: `/api/assessments/${estimate.id}/verifications`,
                headers: { origin: TEST_ORIGIN },
                cookies: { session: teacherToken },
                payload: { decision: 'change', status: 'visible' },
            })
        ).statusCode,
        201,
    );

    const offered = await extraFor(app, student.token);
    const { extra } = offered.json();

    assert.equal(offered.statusCode, 200);
    assert.equal(extra.id, extraId);
    assert.equal(extra.mission, 'Pecahan: bagian yang sama besar');
    assert.equal(extra.content.prompt, EXTRA_PROMPT);
    assert.equal(extra.tries, 0);
    assert.deepEqual(extra.earned, {
        hints: [],
        example: null,
        praise: null,
        reveal: null,
    });

    for (const secret of ['answer', 'praise', 'hints', 'example', 'reveal']) {
        assert.equal(secret in extra.content, false, secret);
    }

    assert.deepEqual(
        (await extraFor(app, student.token, 'indonesian_language')).json(),
        { extra: null },
    );
    assert.equal(
        (await extraFor(app, student.token, 'history')).statusCode,
        400,
    );

    const teacher = await loginAs(app, (await createUser(app)).username);

    assert.equal((await extraFor(app, teacher)).statusCode, 403);

    const [queued] = await app.db
        .insert(analysisRuns)
        .values({ attemptId })
        .returning({ id: analysisRuns.id });

    assert.ok(queued);
    assert.deepEqual((await extraFor(app, student.token)).json(), {
        extra: null,
    });

    await app.db
        .update(analysisRuns)
        .set({ status: 'failed' })
        .where(eq(analysisRuns.id, queued.id));

    assert.deepEqual((await extraFor(app, student.token)).json(), {
        extra: null,
    });
});

test('GET /extra offers nothing with a competency Belum teramati, a queued run, or a prepared mission without an extra challenge', async (t) => {
    const app = await testApp(t);
    const unobserved = await takenMission(app, t, (code) =>
        code === 'C3' ? 'not_observed' : 'visible',
    );
    const prepared = await takenMission(app, t, () => 'visible', demoModule);
    const waiting = await demoClass(app, false, extraModule);
    const queued = await demoStudent(app, waiting.classId);

    await takeDemo(app, queued.token, waiting.assignmentId);

    for (const token of [
        unobserved.student.token,
        prepared.student.token,
        queued.token,
    ]) {
        assert.deepEqual((await extraFor(app, token)).json(), {
            extra: null,
        });
    }
});

test('a themed attempt gets the extra challenge in its theme', async (t) => {
    const app = await testApp(t);
    const provider = await stubProvider(t, [judged(() => 'visible')]);
    const demo = await demoClass(app, false, extraModule);
    const student = await demoStudent(app, demo.classId);

    await seedTheme(app, demo.sessionId, 'football', (text) => `Bola: ${text}`);
    await withInterests(app, student.id, ['football']);
    await runFor(
        app,
        await takeDemo(app, student.token, demo.assignmentId),
        provider.config,
    );

    assert.equal(
        (await extraFor(app, student.token)).json().extra.content.prompt,
        `Bola: ${EXTRA_PROMPT}`,
    );
});

test('an extra try earns hint 1, hint 2, then the reveal, closes for good, and is kept as practice the teacher sees', async (t) => {
    const app = await testApp(t);
    const { student, sessionId, attemptId, classId, teacherToken } =
        await takenMission(app, t);
    const extraId = await extraIdOf(app, sessionId);

    await app.db.insert(learnerAdaptations).values({
        studentId: student.id,
        classId,
        subject: 'mathematics',
        aiHelpFirst: 'example',
        suggestedAt: new Date(),
    });

    const skipped = await tryExtra(app, student.token, extraId, 2, wrong);
    const twins = await Promise.all([
        tryExtra(app, student.token, extraId, 1, wrong),
        tryExtra(app, student.token, extraId, 1, wrong),
    ]);
    const first = twins.find(({ statusCode }) => statusCode === 201);

    assert.deepEqual(
        twins.map(({ statusCode }) => statusCode).sort(),
        [201, 400],
        'two first tries sent at once store one',
    );
    assert.ok(first);

    const second = await tryExtra(app, student.token, extraId, 2, wrong);
    const offered = await extraFor(app, student.token);
    const last = await tryExtra(app, student.token, extraId, 3, wrong);

    assert.equal(skipped.statusCode, 400);
    assert.equal(skipped.json().details[0].field, 'tryNumber');
    assert.equal(first.statusCode, 201);
    assert.equal(first.json().outcome, 'not_yet');
    assert.equal(first.json().earned.hints.length, 1);
    assert.equal(first.json().earned.example, null);
    assert.equal(second.json().earned.hints.length, 2);
    assert.equal(offered.json().extra.tries, 2);
    assert.equal(last.statusCode, 201);
    assert.deepEqual(last.json().earned.reveal, {
        answer: right,
        text: lastCheck.content.reveal,
    });
    assert.deepEqual((await extraFor(app, student.token)).json(), {
        extra: null,
    });
    assert.equal(
        (await tryExtra(app, student.token, extraId, 1, right)).statusCode,
        404,
    );

    const [check] = await app.db
        .select({ id: sessionBlocks.id })
        .from(sessionBlocks)
        .where(
            and(
                eq(sessionBlocks.learningSessionId, sessionId),
                eq(sessionBlocks.kind, 'check'),
            ),
        );

    assert.ok(check);
    assert.equal(
        (await tryExtra(app, student.token, check.id, 1, right)).statusCode,
        404,
    );

    const tries = await app.db
        .select({ id: reviewTries.id })
        .from(reviewTries)
        .where(eq(reviewTries.blockId, extraId));
    const answers = await app.db
        .select({ id: responses.id })
        .from(responses)
        .where(eq(responses.blockId, extraId));
    const runs = await app.db
        .select({ id: analysisRuns.id })
        .from(analysisRuns)
        .where(eq(analysisRuns.attemptId, attemptId));

    assert.equal(tries.length, 3);
    assert.equal(answers.length, 0);
    assert.equal(runs.length, 1);

    const report = await app.inject({
        method: 'GET',
        url: `/api/classes/${classId}/students/${student.id}/report`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: teacherToken },
    });

    assert.equal(report.statusCode, 200);
    assert.deepEqual(
        report
            .json()
            .reviews.map(
                (item: {
                    blockId: number;
                    kind: string;
                    prompt: string;
                    rounds: { tries: number; result: string }[];
                }) => [
                    item.blockId,
                    item.kind,
                    item.prompt,
                    item.rounds.map(({ tries: count, result }) => [
                        count,
                        result,
                    ]),
                ],
            ),
        [[extraId, 'extra', EXTRA_PROMPT, [[3, 'revealed']]]],
    );
});

test('the newest qualifying mission comes first, a right first try closes it, and another student cannot answer it', async (t) => {
    const app = await testApp(t);
    const provider = await stubProvider(t, [
        judged(() => 'visible'),
        judged(() => 'visible'),
    ]);
    const demo = await demoClass(app, false, extraModule);
    const { sessionId: newerSession } = await seedModule(app.db, demo.classId, {
        ...extraModule,
        material: `Demo module ${randomUUID()}`,
    });
    const [newer] = await app.db
        .select({ id: assignments.id })
        .from(assignments)
        .where(
            and(
                eq(assignments.learningSessionId, newerSession),
                eq(assignments.classId, demo.classId),
            ),
        );

    assert.ok(newer);

    const student = await demoStudent(app, demo.classId);

    await runFor(
        app,
        await takeDemo(app, student.token, demo.assignmentId),
        provider.config,
    );
    await runFor(
        app,
        await takeDemo(app, student.token, newer.id),
        provider.config,
    );

    const older = await extraIdOf(app, demo.sessionId);
    const newest = await extraIdOf(app, newerSession);

    assert.equal((await extraFor(app, student.token)).json().extra.id, newest);
    assert.equal(
        (await tryExtra(app, student.token, older, 1, right)).statusCode,
        404,
    );

    const stranger = await demoClass(app, false, extraModule);
    const other = await demoStudent(app, stranger.classId, 'Lain');

    assert.equal(
        (await tryExtra(app, other.token, newest, 1, right)).statusCode,
        404,
    );

    const solved = await tryExtra(app, student.token, newest, 1, right);

    assert.equal(solved.statusCode, 201);
    assert.equal(solved.json().outcome, 'correct');
    assert.equal(solved.json().earned.praise, lastCheck.content.praise);
    assert.equal((await extraFor(app, student.token)).json().extra.id, older);
});

test('a theme must keep the extra challenge answer, and the gate warns about an extra challenge without a page', async (t) => {
    const extra = sessionBlock.parse({
        kind: 'extra_challenge',
        content: { ...lastCheck.content, prompt: EXTRA_PROMPT },
    });
    const changed = sessionBlock.parse({
        kind: 'extra_challenge',
        content: { ...lastCheck.content, prompt: EXTRA_PROMPT, answer: wrong },
    });

    assert.deepEqual(themeProblems(extra, changed), [
        `Theme rule: Keep the answer ${right}`,
    ]);

    const unsourced = {
        ...draft,
        blocks: draft.blocks.map((block) =>
            block.kind === 'extra_challenge' ? { ...block, pages: [] } : block,
        ),
    };
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(unsourced)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    const review = (
        await get(app, token, `/api/studio/sessions/${session.id}`)
    ).json();

    assert.equal(session.blocks.at(-1)?.kind, 'extra_challenge');
    assert.deepEqual(review.issues, []);
    assert.deepEqual(review.warnings[0], {
        code: 'no_page_source',
        blocks: [session.blocks.length],
    });
});

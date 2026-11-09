import assert from 'node:assert/strict';
import { test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
    analysisRuns,
    assessments,
    blockCompetencies,
    competencies,
    sessionBlocks,
} from '../src/db/schema.ts';
import { stubProvider } from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    refsOf,
    runFor,
    takeDemo,
    verdicts,
} from './demo-attempts.ts';
import { createUser, loginAs, TEST_ORIGIN, testApp } from './helpers.ts';

const checkContent = z.object({
    answer: z.string(),
    options: z.array(z.object({ id: z.string() })),
});

async function practisingStudent(
    app: FastifyInstance,
    t: Parameters<typeof stubProvider>[0],
) {
    const provider = await stubProvider(t, [
        verdicts((competency) =>
            competency.code === 'C2'
                ? {
                      status: 'developing',
                      evidence: refsOf(competency),
                      followUps: ['Mengapa potongannya harus sama besar?'],
                  }
                : {},
        ),
    ]);
    const demo = await demoClass(app);
    const student = await demoStudent(app, demo.classId);
    const attemptId = await takeDemo(app, student.token, demo.assignmentId);

    await runFor(app, attemptId, provider.config);

    const [c2] = await app.db
        .select({ blockId: sessionBlocks.id, content: sessionBlocks.content })
        .from(sessionBlocks)
        .innerJoin(
            blockCompetencies,
            eq(blockCompetencies.blockId, sessionBlocks.id),
        )
        .innerJoin(
            competencies,
            eq(competencies.id, blockCompetencies.competencyId),
        )
        .innerJoin(analysisRuns, eq(analysisRuns.attemptId, attemptId))
        .innerJoin(
            assessments,
            and(
                eq(assessments.runId, analysisRuns.id),
                eq(assessments.competencyId, competencies.id),
            ),
        )
        .where(
            and(eq(competencies.code, 'C2'), eq(sessionBlocks.kind, 'check')),
        );

    assert.ok(c2, 'the demo has a check on C2');

    const content = checkContent.parse(c2.content);
    const wrong = content.options.find(({ id }) => id !== content.answer);

    assert.ok(wrong);

    return {
        ...demo,
        student,
        attemptId,
        blockId: c2.blockId,
        right: content.answer,
        wrong: wrong.id,
    };
}

function tryOn(
    app: FastifyInstance,
    token: string,
    blockId: number,
    tryNumber: number,
    choice: string,
) {
    return asStudent(app, token, 'POST', '/review/tries', {
        blockId,
        tryNumber,
        answer: {
            kind: 'check',
            choice,
            reason: 'Karena bagiannya sama besar.',
        },
    });
}

test('Ulang Yuk offers the approved checks of competencies still Berkembang or Perlu verifikasi, without their answers, and none once the teacher decides Terlihat', async (t) => {
    const app = await testApp(t);
    const { student, blockId, teacherToken, attemptId } =
        await practisingStudent(app, t);
    const review = await asStudent(
        app,
        student.token,
        'GET',
        '/review?subject=mathematics',
    );
    const other = await asStudent(
        app,
        student.token,
        'GET',
        '/review?subject=indonesian_language',
    );
    const [question] = review.json().questions;

    assert.equal(review.statusCode, 200);
    assert.equal(review.json().questions.length, 1);
    assert.equal(question.id, blockId);
    assert.equal(question.mission, 'Pecahan: bagian yang sama besar');
    assert.equal(question.tries, 0);
    assert.deepEqual(question.earned, {
        hints: [],
        example: null,
        praise: null,
        reveal: null,
    });
    assert.equal('answer' in question.content, false);
    assert.equal('hints' in question.content, false);
    assert.deepEqual(other.json(), { questions: [] });
    assert.equal(
        (await asStudent(app, student.token, 'GET', '/review?subject=history'))
            .statusCode,
        400,
    );

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

    const decided = await app.inject({
        method: 'POST',
        url: `/api/assessments/${estimate.id}/verifications`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: teacherToken },
        payload: { decision: 'change', status: 'visible' },
    });

    assert.equal(decided.statusCode, 201);
    assert.deepEqual(
        (
            await asStudent(
                app,
                student.token,
                'GET',
                '/review?subject=mathematics',
            )
        ).json(),
        { questions: [] },
    );
});

test('a practice try is judged like a mission try, earns a hint after a wrong try and the answer after the last, starts a new round once closed, and shows on the student report', async (t) => {
    const app = await testApp(t);
    const { student, blockId, right, wrong, classId, teacherToken } =
        await practisingStudent(app, t);
    const first = await tryOn(app, student.token, blockId, 1, wrong);
    const repeated = await tryOn(app, student.token, blockId, 1, wrong);
    const second = await tryOn(app, student.token, blockId, 2, wrong);
    const last = await tryOn(app, student.token, blockId, 3, wrong);
    const reopened = await asStudent(
        app,
        student.token,
        'GET',
        '/review?subject=mathematics',
    );
    const again = await tryOn(app, student.token, blockId, 1, right);

    assert.equal(first.statusCode, 201);
    assert.equal(first.json().outcome, 'not_yet');
    assert.equal(first.json().earned.hints.length, 1);
    assert.equal(repeated.statusCode, 400);
    assert.equal(second.json().earned.hints.length, 2);
    assert.equal(last.json().earned.reveal.answer, right);
    assert.equal(reopened.json().questions[0].tries, 0);
    assert.equal(again.statusCode, 201);
    assert.equal(again.json().outcome, 'correct');
    assert.ok(again.json().earned.praise);

    const stranger = await demoClass(app);
    const outside = await tryOn(
        app,
        (await demoStudent(app, stranger.classId, 'Lain')).token,
        blockId,
        1,
        right,
    );
    const report = await app.inject({
        method: 'GET',
        url: `/api/classes/${classId}/students/${student.id}/report`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: teacherToken },
    });
    const teacher = await loginAs(app, (await createUser(app)).username);

    assert.equal(outside.statusCode, 404);
    assert.deepEqual(
        report
            .json()
            .reviews.map(
                ({
                    blockId: id,
                    rounds,
                }: {
                    blockId: number;
                    rounds: { tries: number; result: string }[];
                }) => [id, rounds.map(({ tries, result }) => [tries, result])],
            ),
        [
            [
                blockId,
                [
                    [3, 'revealed'],
                    [1, 'correct'],
                ],
            ],
        ],
    );
    assert.equal(
        (
            await app.inject({
                method: 'GET',
                url: '/api/student/review?subject=mathematics',
                headers: { origin: TEST_ORIGIN },
                cookies: { session: teacher },
            })
        ).statusCode,
        403,
    );
});

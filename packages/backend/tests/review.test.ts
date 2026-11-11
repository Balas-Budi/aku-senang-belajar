import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
    analysisRuns,
    assessments,
    assignments,
    blockCompetencies,
    competencies,
    learningSessions,
    sessionBlocks,
} from '../src/db/schema.ts';
import { demoModule } from '../src/learning/demo-module.ts';
import { seedModule } from '../src/learning/seed-module.ts';
import { stubProvider } from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoDiagram,
    demoStudent,
    drawnDemoModule,
    drawnLabel,
    keptSummary,
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
    drawn = false,
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
    const demo = await demoClass(
        app,
        false,
        drawn ? drawnDemoModule : undefined,
    );
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

test('Ulang Yuk puts first the question whose weak competency the newest kept summary names, and keeps the mission order without summaries', async (t) => {
    const app = await testApp(t);
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
        verdicts((competency) =>
            competency.code === 'C1'
                ? {
                      status: 'developing',
                      evidence: refsOf(competency),
                      followUps: ['Bagian mana yang diarsir?'],
                  }
                : {},
        ),
    ]);
    const demo = await demoClass(app);
    const { sessionId: newerSession } = await seedModule(app.db, demo.classId, {
        ...demoModule,
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

    const checkOn = async (sessionId: number, code: string) => {
        const [row] = await app.db
            .select({ id: sessionBlocks.id })
            .from(sessionBlocks)
            .innerJoin(
                blockCompetencies,
                eq(blockCompetencies.blockId, sessionBlocks.id),
            )
            .innerJoin(
                competencies,
                eq(competencies.id, blockCompetencies.competencyId),
            )
            .where(
                and(
                    eq(sessionBlocks.learningSessionId, sessionId),
                    eq(sessionBlocks.kind, 'check'),
                    eq(competencies.code, code),
                ),
            );

        assert.ok(row);

        return row.id;
    };
    const olderC2 = await checkOn(demo.sessionId, 'C2');
    const newerC1 = await checkOn(newerSession, 'C1');
    const order = async () =>
        (
            await asStudent(
                app,
                student.token,
                'GET',
                '/review?subject=mathematics',
            )
        )
            .json()
            .questions.map(({ id }: { id: number }) => id);

    assert.deepEqual(await order(), [newerC1, olderC2]);

    const note = (text: string, ago: number, assignmentId?: number) =>
        keptSummary(app, {
            studentId: student.id,
            classId: demo.classId,
            assignmentId,
            text,
            writtenAt: new Date(Date.now() - ago),
        });

    const sibling = async (sessionId: number) => {
        const [first] = await app.db
            .select({
                moduleId: learningSessions.moduleId,
                kind: sessionBlocks.kind,
                content: sessionBlocks.content,
            })
            .from(sessionBlocks)
            .innerJoin(
                learningSessions,
                eq(learningSessions.id, sessionBlocks.learningSessionId),
            )
            .where(
                and(
                    eq(sessionBlocks.learningSessionId, sessionId),
                    eq(sessionBlocks.position, 1),
                ),
            );

        assert.ok(first);

        const [session] = await app.db
            .insert(learningSessions)
            .values({
                moduleId: first.moduleId,
                title: `Misi ${randomUUID()}`,
                summary: 'Misi lanjutan di bab yang sama.',
                status: 'ready',
            })
            .returning({ id: learningSessions.id });

        assert.ok(session);
        await app.db.insert(sessionBlocks).values({
            learningSessionId: session.id,
            position: 1,
            kind: first.kind,
            content: first.content,
        });

        const [assigned] = await app.db
            .insert(assignments)
            .values({ learningSessionId: session.id, classId: demo.classId })
            .returning({ id: assignments.id });

        assert.ok(assigned);

        return assigned.id;
    };

    await note(
        'Siswa menunjuk bagian yang diarsir pada C1.',
        120_000,
        await sibling(newerSession),
    );
    await note(
        'Siswa masih membagi tidak sama besar pada C2.',
        60_000,
        await sibling(demo.sessionId),
    );
    await note('Di misi lain, C1 masih berkembang.', 30_000);
    await note(
        'Siswa membandingkan pecahan dengan gambar, tanpa catatan kompetensi.',
        0,
    );

    assert.deepEqual(
        await order(),
        [olderC2, newerC1],
        'the newer note on the same chapter wins, and a code named in another chapter moves nothing',
    );

    await note(
        'Siswa masih ragu menunjuk bagian pada C1.',
        -1_000,
        await sibling(newerSession),
    );

    assert.deepEqual(
        await order(),
        [newerC1, olderC2],
        'the newest note naming a weak competency puts its question first',
    );
});

test('an Ulang Yuk question carries its diagram, and a hint diagram comes only with its earned hint', async (t) => {
    const app = await testApp(t);
    const { student, blockId, wrong } = await practisingStudent(app, t, true);
    const review = await asStudent(
        app,
        student.token,
        'GET',
        '/review?subject=mathematics',
    );
    const first = await tryOn(app, student.token, blockId, 1, wrong);

    assert.equal(review.statusCode, 200);
    assert.deepEqual(
        review.json().questions[0].content.diagram,
        demoDiagram(drawnLabel('soal', 4)),
    );

    for (const secret of ['petunjuk 1', 'petunjuk 2', 'contoh']) {
        assert.equal(review.body.includes(drawnLabel(secret, 4)), false);
    }

    assert.equal(first.statusCode, 201);
    assert.deepEqual(
        first.json().earned.hints[0].diagram,
        demoDiagram(drawnLabel('petunjuk 1', 4)),
    );
    assert.equal(first.body.includes(drawnLabel('petunjuk 2', 4)), false);
    assert.equal(first.json().earned.example, null);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    analysisRuns,
    assessments,
    assignments,
    attempts,
    classMembers,
    competencies,
    learningSessions,
    sessionBlocks,
    sessionCompetencies,
} from '../src/db/schema.ts';
import { claimSummary, processSummary } from '../src/memory/summaries.ts';
import {
    CLASS_REPORT_PROMPT,
    STUDENT_REPORT_PROMPT,
} from '../src/memory/reports.ts';
import type { AiConfig } from '../src/ai/chat.ts';
import { completion, type Reply, stubProvider } from './ai-stub.ts';
import {
    demoClass,
    demoStudent,
    runFor,
    takeDemo,
    verdicts,
} from './demo-attempts.ts';
import { createUser, loginAs, TEST_ORIGIN, testApp } from './helpers.ts';

const written =
    'C2 benar setelah satu petunjuk: siswa lalu menjelaskan bahwa potongannya harus sama besar.';
const reportText =
    'Siswa mengenali seperempat pada gambar dan membandingkan pecahan dengan benar. Pada C2 siswa memperbaiki jawabannya setelah petunjuk; guru dapat menanyakan lagi mengapa potongan harus sama besar.';

function reply(text: string): Reply {
    return {
        body: completion(
            JSON.stringify(
                text.startsWith('C2') ? { summary: text } : { text },
            ),
        ),
    };
}

function call(
    app: FastifyInstance,
    token: string,
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    payload?: object,
) {
    return app.inject({
        method,
        url: `/api${url}`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload,
    });
}

async function chapterOf(app: FastifyInstance, assignmentId: number) {
    const [row] = await app.db
        .select({ moduleId: learningSessions.moduleId })
        .from(assignments)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .where(eq(assignments.id, assignmentId));

    assert.ok(row);

    return row.moduleId;
}

async function laterMission(
    app: FastifyInstance,
    {
        classId,
        moduleId,
        studentId,
    }: { classId: number; moduleId: number; studentId: number },
) {
    const [session] = await app.db
        .insert(learningSessions)
        .values({
            moduleId,
            title: 'Misi lanjutan',
            summary: 'Latihan lagi.',
            status: 'ready',
        })
        .returning({ id: learningSessions.id });
    const [competency] = await app.db
        .select({ id: competencies.id })
        .from(competencies)
        .where(
            and(
                eq(competencies.moduleId, moduleId),
                eq(competencies.code, 'C2'),
            ),
        );

    assert.ok(session && competency);

    const [block] = await app.db
        .insert(sessionBlocks)
        .values({
            learningSessionId: session.id,
            position: 1,
            kind: 'check',
            content: {},
        })
        .returning({ id: sessionBlocks.id });

    assert.ok(block);
    await app.db
        .insert(sessionCompetencies)
        .values({ learningSessionId: session.id, competencyId: competency.id });

    const [later] = await app.db
        .insert(assignments)
        .values({ learningSessionId: session.id, classId })
        .returning({ id: assignments.id });

    assert.ok(later);

    const [attempt] = await app.db
        .insert(attempts)
        .values({
            assignmentId: later.id,
            studentId,
            status: 'submitted',
            currentBlockId: block.id,
            submittedAt: new Date(Date.now() + 60_000),
        })
        .returning({ id: attempts.id });

    assert.ok(attempt);

    const [run] = await app.db
        .insert(analysisRuns)
        .values({
            attemptId: attempt.id,
            status: 'succeeded',
            model: 'test-model',
            finishedAt: new Date(),
        })
        .returning({ id: analysisRuns.id });

    assert.ok(run);
    await app.db.insert(assessments).values({
        runId: run.id,
        competencyId: competency.id,
        status: 'visible',
        reason: 'Benar pada percobaan pertama.',
        uncertainty: 'low',
        flags: [],
        evidence: [],
        followUps: [],
    });

    return later.id;
}

async function analysedClass(app: FastifyInstance, ai: AiConfig) {
    const { teacherToken, classId, assignmentId } = await demoClass(app);
    const wulan = await demoStudent(app, classId);
    const bayu = await demoStudent(app, classId, 'Bayu Putra');
    const attemptId = await takeDemo(app, wulan.token, assignmentId);

    await runFor(app, attemptId, ai);

    return {
        teacherToken,
        classId,
        assignmentId,
        moduleId: await chapterOf(app, assignmentId),
        wulan,
        bayu,
        attemptId,
    };
}

async function writeSummary(
    app: FastifyInstance,
    attemptId: number,
    ai: AiConfig,
) {
    const claimed = await claimSummary(app.db, { embedding: false, attemptId });

    assert.ok(claimed, 'the analysed attempt has a summary to write');
    await processSummary(app, claimed, ai, null);
}

async function settled(app: FastifyInstance, token: string, url: string) {
    const deadline = Date.now() + 5_000;

    for (;;) {
        const body = (await call(app, token, 'GET', url)).json();

        if (body.report?.drafting !== 'generating') return body;
        assert.ok(Date.now() < deadline, 'the report draft did not finish');
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

async function estimateOf(
    app: FastifyInstance,
    attemptId: number,
    code: string,
) {
    const [row] = await app.db
        .select({ id: assessments.id })
        .from(assessments)
        .innerJoin(analysisRuns, eq(analysisRuns.id, assessments.runId))
        .innerJoin(competencies, eq(competencies.id, assessments.competencyId))
        .where(
            and(
                eq(analysisRuns.attemptId, attemptId),
                eq(competencies.code, code),
            ),
        );

    assert.ok(row);

    return row.id;
}

test('the chapter map shows per current student the newest status of each competency with its label, the counts, and the missions finished (FR-045)', async (t) => {
    const provider = await stubProvider(t, [
        verdicts((competency) =>
            competency.code === 'C2'
                ? {
                      status: 'developing',
                      followUps: ['Mengapa harus sama besar?'],
                  }
                : {},
        ),
    ]);
    const app = await testApp(t);
    const { teacherToken, classId, moduleId, wulan, bayu, attemptId } =
        await analysedClass(app, provider.config);
    const agreed = await call(
        app,
        teacherToken,
        'POST',
        `/assessments/${await estimateOf(app, attemptId, 'C1')}/verifications`,
        { decision: 'agree' },
    );

    assert.equal(agreed.statusCode, 201);

    const before = (
        await call(
            app,
            teacherToken,
            'GET',
            `/classes/${classId}/chapters/${moduleId}/report`,
        )
    ).json();
    const later = await laterMission(app, {
        classId,
        moduleId,
        studentId: wulan.id,
    });
    const response = await call(
        app,
        teacherToken,
        'GET',
        `/classes/${classId}/chapters/${moduleId}/report`,
    );
    const map = response.json();
    const code = (competencyId: number) =>
        map.competencies.find(({ id }: { id: number }) => id === competencyId)
            ?.code;

    assert.equal(response.statusCode, 200);
    assert.equal(
        before.students
            .find(({ id }: { id: number }) => id === wulan.id)
            .competencies.find(
                ({ competencyId }: { competencyId: number }) =>
                    code(competencyId) === 'C2',
            ).status,
        'developing',
    );
    assert.deepEqual(
        map.missions
            .map(
                ({
                    title,
                    submittedCount,
                    analysedCount,
                }: Record<string, unknown>) => [
                    title,
                    submittedCount,
                    analysedCount,
                ],
            )
            .at(-1),
        ['Misi lanjutan', 1, 1],
    );
    assert.deepEqual(
        map.students.map(
            ({ id, finished }: { id: number; finished: number }) => [
                id,
                finished,
            ],
        ),
        [
            [bayu.id, 0],
            [wulan.id, 2],
        ],
    );
    assert.deepEqual(
        map.students[1].competencies.map(
            (cell: {
                competencyId: number;
                status: string;
                decision: string | null;
                assignmentId: number;
            }) => [
                code(cell.competencyId),
                cell.status,
                cell.decision,
                cell.assignmentId === later,
            ],
        ),
        [
            ['C1', 'visible', 'agree', false],
            ['C2', 'visible', null, true],
            ['C3', 'visible', null, false],
        ],
    );
    assert.deepEqual(
        map.counts.map(
            ({
                competencyId,
                visible,
                developing,
                withEvidence,
            }: Record<string, number>) => [
                code(competencyId),
                visible,
                developing,
                withEvidence,
            ],
        ),
        [
            ['C1', 1, 0, 1],
            ['C2', 1, 0, 1],
            ['C3', 1, 0, 1],
        ],
    );
    assert.equal(map.studentCount, 2);
    assert.equal(map.report, null);

    await app.db
        .delete(classMembers)
        .where(eq(classMembers.studentId, wulan.id));

    const after = (
        await call(
            app,
            teacherToken,
            'GET',
            `/classes/${classId}/chapters/${moduleId}/report`,
        )
    ).json();
    const stranger = await loginAs(app, (await createUser(app)).username);

    assert.deepEqual(
        after.students.map(({ id }: { id: number }) => id),
        [bayu.id],
    );
    assert.equal(
        (
            await call(
                app,
                stranger,
                'GET',
                `/classes/${classId}/chapters/${moduleId}/report`,
            )
        ).statusCode,
        404,
    );
    assert.equal(
        (
            await call(
                app,
                teacherToken,
                'GET',
                `/classes/${classId}/chapters/${moduleId + 100000}/report`,
            )
        ).statusCode,
        404,
    );
});

test('a student report lists every mission with its estimates, the decisions, and the summary, and a summary the teacher leaves out is marked and dropped (FR-046)', async (t) => {
    const provider = await stubProvider(t, [verdicts(), reply(written)]);
    const app = await testApp(t);
    const { teacherToken, classId, moduleId, wulan, attemptId } =
        await analysedClass(app, provider.config);

    await writeSummary(app, attemptId, provider.config);
    await call(
        app,
        teacherToken,
        'POST',
        `/assessments/${await estimateOf(app, attemptId, 'C2')}/verifications`,
        { decision: 'change', status: 'developing', note: 'Wulan masih ragu.' },
    );
    await laterMission(app, { classId, moduleId, studentId: wulan.id });

    const url = `/classes/${classId}/students/${wulan.id}/report`;
    const history = (await call(app, teacherToken, 'GET', url)).json();
    const [first, second] = history.missions;
    const c2 = first.competencies.find(
        ({ code }: { code: string }) => code === 'C2',
    );

    assert.equal(history.student.name, 'Wulan Sari');
    assert.deepEqual(
        history.missions.map(({ title }: { title: string }) => title),
        [first.title, 'Misi lanjutan'],
    );
    assert.equal(first.summary.text, written);
    assert.equal(first.summary.excluded, false);
    assert.equal(second.summary, null);
    assert.equal(c2.estimate, 'visible');
    assert.deepEqual(c2.shown, { status: 'developing', decision: 'change' });
    assert.equal(c2.verifications[0].note, 'Wulan masih ragu.');
    assert.equal(history.summaryCount, 1);

    const excluded = await call(
        app,
        teacherToken,
        'PUT',
        `/learner-summaries/${first.summary.id}/excluded`,
        { excluded: true },
    );
    const after = (await call(app, teacherToken, 'GET', url)).json();
    const stranger = await loginAs(app, (await createUser(app)).username);

    assert.deepEqual(excluded.json(), { id: first.summary.id, excluded: true });
    assert.equal(after.missions[0].summary.excluded, true);
    assert.equal(after.summaryCount, 0);
    assert.equal(
        (
            await call(
                app,
                stranger,
                'PUT',
                `/learner-summaries/${first.summary.id}/excluded`,
                { excluded: false },
            )
        ).statusCode,
        404,
    );
    assert.equal(
        (
            await call(
                app,
                teacherToken,
                'GET',
                `/classes/${classId}/students/${wulan.id + 100000}/report`,
            )
        ).statusCode,
        404,
    );
    assert.equal(
        (
            await call(
                app,
                teacherToken,
                'PUT',
                `/learner-summaries/${first.summary.id}/excluded`,
                {},
            )
        ).statusCode,
        400,
    );
});

test('a student report is drafted from the kept summaries without the student or the class, then checked by the teacher, and a changed memory marks it out of date', async (t) => {
    const provider = await stubProvider(t, [
        verdicts(),
        reply(written),
        { ...reply(reportText), delay: 200 },
    ]);
    const app = await testApp(t, provider.config);
    const { teacherToken, classId, wulan, attemptId } = await analysedClass(
        app,
        provider.config,
    );

    await writeSummary(app, attemptId, provider.config);

    const url = `/classes/${classId}/students/${wulan.id}/report`;
    const started = await call(app, teacherToken, 'POST', `${url}/draft`);
    const again = await call(app, teacherToken, 'POST', `${url}/draft`);
    const drafted = await settled(app, teacherToken, url);
    const request = provider.requests[2];

    assert.equal(started.statusCode, 202);
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().name, 'REPORT_DRAFTING');
    assert.ok(request);
    assert.equal(request.body.messages[0]?.content, STUDENT_REPORT_PROMPT);
    assert.ok(request.text.includes('setelah satu petunjuk'));

    for (const withheld of ['Wulan', wulan.username, 'Kelas 4A']) {
        assert.equal(
            request.text.includes(withheld),
            false,
            `the model received ${withheld}`,
        );
    }

    assert.equal(drafted.report.draft, reportText);
    assert.equal(drafted.report.text, null);
    assert.equal(drafted.report.outdated, false);

    const checked = await call(
        app,
        teacherToken,
        'PUT',
        `/reports/${drafted.report.id}`,
        {
            text: 'Diperiksa: Wulan perlu latihan C2.',
        },
    );
    const stranger = await loginAs(app, (await createUser(app)).username);

    assert.equal(checked.statusCode, 200);
    assert.equal(checked.json().text, 'Diperiksa: Wulan perlu latihan C2.');
    assert.equal(
        (
            await call(app, stranger, 'PUT', `/reports/${drafted.report.id}`, {
                text: 'x',
            })
        ).statusCode,
        404,
    );

    await call(
        app,
        teacherToken,
        'PUT',
        `/learner-summaries/${drafted.missions[0].summary.id}/excluded`,
        { excluded: true },
    );

    const after = (await call(app, teacherToken, 'GET', url)).json();

    assert.equal(after.report.text, 'Diperiksa: Wulan perlu latihan C2.');
    assert.ok(after.report.checkedAt);
    assert.equal(after.report.outdated, true);
});

test('a class report needs a summary, gets the counts and the notes without names, and a failed draft can be drafted again', async (t) => {
    const provider = await stubProvider(t, [
        verdicts(),
        reply(written),
        { status: 503 },
        reply(reportText),
    ]);
    const app = await testApp(t, provider.config);
    const { teacherToken, classId, moduleId, wulan, bayu, attemptId } =
        await analysedClass(app, provider.config);
    const url = `/classes/${classId}/chapters/${moduleId}/report`;
    const refused = await call(app, teacherToken, 'POST', `${url}/draft`);

    assert.equal(refused.statusCode, 409);
    assert.equal(refused.json().name, 'NO_SUMMARIES');

    await writeSummary(app, attemptId, provider.config);
    assert.equal(
        (await call(app, teacherToken, 'POST', `${url}/draft`)).statusCode,
        202,
    );
    assert.equal(
        (await settled(app, teacherToken, url)).report.drafting,
        'failed',
    );
    assert.equal(
        (await call(app, teacherToken, 'POST', `${url}/draft`)).statusCode,
        202,
    );

    const drafted = await settled(app, teacherToken, url);
    const request = provider.requests[3];

    assert.ok(request);
    assert.equal(drafted.report.draft, reportText);
    assert.equal(drafted.report.drafting, null);
    assert.equal(request.body.messages[0]?.content, CLASS_REPORT_PROMPT);

    const sent = JSON.parse(request.body.messages[1]?.content ?? '');

    assert.deepEqual(sent.notes, [written]);
    assert.equal(sent.students, 2);
    assert.deepEqual(
        sent.competencies.map(
            ({ code, visible }: { code: string; visible: number }) => [
                code,
                visible,
            ],
        ),
        [
            ['C1', 1],
            ['C2', 1],
            ['C3', 1],
        ],
    );

    for (const withheld of [
        'Wulan',
        'Bayu',
        wulan.username,
        bayu.username,
        'Kelas 4A',
    ]) {
        assert.equal(
            request.text.includes(withheld),
            false,
            `the model received ${withheld}`,
        );
    }
});

test('the chapter map as CSV labels each status as an AI estimate or a teacher decision, holds no answers, and defuses formulas in names (FR-048)', async (t) => {
    const provider = await stubProvider(t, [verdicts()]);
    const app = await testApp(t);
    const { teacherToken, classId, moduleId, attemptId } = await analysedClass(
        app,
        provider.config,
    );

    await demoStudent(app, classId, '=SUM(A1)');
    await call(
        app,
        teacherToken,
        'POST',
        `/assessments/${await estimateOf(app, attemptId, 'C1')}/verifications`,
        { decision: 'agree' },
    );

    const response = await call(
        app,
        teacherToken,
        'GET',
        `/classes/${classId}/chapters/${moduleId}/report.csv`,
    );
    const lines = response.body.replace(/^﻿/, '').trim().split('\r\n');

    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'] ?? '', /^text\/csv/);
    assert.match(response.headers['content-disposition'] ?? '', /attachment/);
    assert.deepEqual(lines, [
        'Siswa,Misi selesai,C1,C2,C3',
        "'=SUM(A1),0 dari 1,,,",
        'Bayu Putra,0 dari 1,,,',
        'Wulan Sari,1 dari 1,Terlihat (Diverifikasi guru),Terlihat (Saran AI),Terlihat (Saran AI)',
    ]);
    assert.equal(response.body.includes('Karena dipotong empat'), false);
});

test('the evidence of one mission carries its summary', async (t) => {
    const provider = await stubProvider(t, [verdicts(), reply(written)]);
    const app = await testApp(t);
    const { teacherToken, classId, assignmentId, wulan, attemptId } =
        await analysedClass(app, provider.config);
    const url = `/classes/${classId}/assignments/${assignmentId}/students/${wulan.id}`;

    assert.equal(
        (await call(app, teacherToken, 'GET', url)).json().summary,
        null,
    );
    await writeSummary(app, attemptId, provider.config);
    assert.deepEqual(
        (await call(app, teacherToken, 'GET', url)).json().summary?.text,
        written,
    );
});

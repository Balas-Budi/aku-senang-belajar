import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { analysisRuns, classMembers } from '../src/db/schema.ts';
import { demoModule } from '../src/learning/demo-module.ts';
import { stubProvider } from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    drawnDemoModule,
    drawnLabel,
    refsOf,
    runFor,
    takeDemo,
    verdicts,
} from './demo-attempts.ts';
import { createUser, loginAs, TEST_ORIGIN, testApp } from './helpers.ts';

type Cell = {
    competencyId: number;
    assessmentId: number;
    status: string;
    decision: string | null;
};

type Results = {
    assignment: object;
    competencies: { id: number; code: string }[];
    students: {
        name: string;
        progress: string;
        attemptId: number | null;
        analysis: string | null;
        competencies: Cell[];
    }[];
};

type Assessment = {
    id: number;
    status: string;
    reason: string;
    evidence: number[];
    followUps: string[];
    shown: { status: string; decision: string | null };
    verifications: { decision: string; status: string; note: string | null }[];
};

type Evidence = {
    student: { id: number; name: string };
    progress: string;
    attemptId: number | null;
    analysis: string | null;
    competencies: {
        code: string;
        rubric: { visible: string[] } | null;
        questions: {
            kind: string;
            tries: {
                ref: number;
                try: number;
                choice: string;
                outcome: string;
            }[];
            help: { hints: number };
        }[];
        selfReport: { ref: number } | null;
        assessment: Assessment | null;
    }[];
};

const demoHeader = {
    title: demoModule.session.title,
    subject: demoModule.subject,
    moduleTitle: demoModule.module,
};

function asTeacher(
    app: FastifyInstance,
    token: string,
    method: 'GET' | 'POST',
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

async function classWithResults(t: TestContext, app: FastifyInstance) {
    const demo = await demoClass(app, true);
    const ayu = await demoStudent(app, demo.classId, 'Ayu Lestari');
    const bima = await demoStudent(app, demo.classId, 'Bima Putra');
    const citra = await demoStudent(app, demo.classId, 'Citra Dewi');
    const dimas = await demoStudent(app, demo.classId, 'Dimas Saputra');
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
    const analysed = await takeDemo(app, ayu.token, demo.assignmentId);
    const waiting = await takeDemo(app, bima.token, demo.assignmentId);
    const started: { id: number } = (
        await asStudent(
            app,
            citra.token,
            'POST',
            `/assignments/${demo.assignmentId}/attempt`,
        )
    ).json();

    await runFor(app, analysed, provider.config);

    return {
        ...demo,
        ayu,
        bima,
        dimas,
        attempts: { analysed, waiting, working: started.id },
    };
}

type Demo = Awaited<ReturnType<typeof classWithResults>>;

function resultsOf(app: FastifyInstance, demo: Demo) {
    return asTeacher(
        app,
        demo.teacherToken,
        'GET',
        `/classes/${demo.classId}/assignments/${demo.assignmentId}/results`,
    );
}

function evidenceFor(app: FastifyInstance, demo: Demo, studentId: number) {
    return asTeacher(
        app,
        demo.teacherToken,
        'GET',
        `/classes/${demo.classId}/assignments/${demo.assignmentId}/students/${studentId}`,
    );
}

async function c2Of(app: FastifyInstance, demo: Demo) {
    const body: Evidence = (await evidenceFor(app, demo, demo.ayu.id)).json();
    const assessment = body.competencies.find(
        ({ code }) => code === 'C2',
    )?.assessment;

    assert.ok(assessment, 'C2 of the analysed student has an assessment');

    return assessment;
}

test('a class lists its assigned sessions with how many students submitted and were analysed', async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const response = await asTeacher(
        app,
        demo.teacherToken,
        'GET',
        `/classes/${demo.classId}/assignments`,
    );

    const body: ({ assignedAt: string } & Record<string, unknown>)[] =
        response.json();

    assert.equal(response.statusCode, 200);
    assert.ok(body.every(({ assignedAt }) => Date.parse(assignedAt) > 0));
    assert.deepEqual(
        body.map(({ assignedAt, ...assignment }) => assignment),
        [
            {
                id: demo.assignmentId,
                ...demoHeader,
                studentCount: 4,
                submittedCount: 2,
                analysedCount: 1,
            },
        ],
    );
});

test('the results of a session show each student with progress, the analysis state, and per competency the status (FR-039, T-10)', async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const response = await resultsOf(app, demo);
    const body: Results = response.json();

    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.assignment, {
        id: demo.assignmentId,
        ...demoHeader,
    });
    assert.deepEqual(
        body.competencies.map(({ code }) => code),
        ['C1', 'C2', 'C3'],
    );
    assert.deepEqual(
        body.students.map(
            ({ name, progress, attemptId, analysis, competencies }) => ({
                name,
                progress,
                attemptId,
                analysis,
                cells: competencies.map(({ status, decision }) => [
                    status,
                    decision,
                ]),
            }),
        ),
        [
            {
                name: 'Ayu Lestari',
                progress: 'submitted',
                attemptId: demo.attempts.analysed,
                analysis: 'succeeded',
                cells: [
                    ['visible', null],
                    ['developing', null],
                    ['visible', null],
                ],
            },
            {
                name: 'Bima Putra',
                progress: 'submitted',
                attemptId: demo.attempts.waiting,
                analysis: 'queued',
                cells: [],
            },
            {
                name: 'Citra Dewi',
                progress: 'in_progress',
                attemptId: demo.attempts.working,
                analysis: null,
                cells: [],
            },
            {
                name: 'Dimas Saputra',
                progress: 'not_started',
                attemptId: null,
                analysis: null,
                cells: [],
            },
        ],
    );
    assert.deepEqual(
        body.students[0]?.competencies.map(({ competencyId }) => competencyId),
        body.competencies.map(({ id }) => id),
    );
});

test("a student's evidence shows per competency the estimate, its reason, the cited answers with the help used, the rubric, and the follow-up questions (T-11)", async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const response = await evidenceFor(app, demo, demo.ayu.id);
    const body: Evidence = response.json();
    const c2 = body.competencies.find(({ code }) => code === 'C2');

    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.student, { id: demo.ayu.id, name: 'Ayu Lestari' });
    assert.deepEqual(
        [body.progress, body.attemptId, body.analysis],
        ['submitted', demo.attempts.analysed, 'succeeded'],
    );
    assert.deepEqual(
        body.competencies.map(({ code }) => code),
        ['C1', 'C2', 'C3'],
    );
    assert.ok(c2?.rubric && c2.rubric.visible.length > 0);
    assert.ok(c2.selfReport);
    assert.deepEqual(
        c2.questions.map(({ kind }) => kind),
        ['check', 'challenge'],
    );
    assert.deepEqual(
        c2.questions[0]?.tries.map(({ try: number, choice, outcome }) => [
            number,
            choice,
            outcome,
        ]),
        [
            [1, 'a', 'not_yet'],
            [2, 'b', 'correct'],
        ],
    );
    assert.equal(c2.questions[0]?.help.hints, 1);

    const { assessment } = c2;

    assert.ok(assessment);
    assert.equal(assessment.status, 'developing');
    assert.equal(
        assessment.reason,
        'Benar setelah satu percobaan yang belum tepat.',
    );
    assert.deepEqual(
        assessment.evidence,
        c2.questions.flatMap(({ tries }) => tries.map(({ ref }) => ref)),
    );
    assert.deepEqual(assessment.followUps, [
        'Mengapa potongan roti harus sama besar?',
    ]);
    assert.deepEqual(assessment.shown, {
        status: 'developing',
        decision: null,
    });
    assert.deepEqual(assessment.verifications, []);

    const waiting: Evidence = (
        await evidenceFor(app, demo, demo.bima.id)
    ).json();

    assert.equal(waiting.analysis, 'queued');
    assert.ok(
        waiting.competencies.every(
            ({ questions, assessment }) =>
                questions.length > 0 && assessment === null,
        ),
    );

    const absent = await evidenceFor(app, demo, demo.dimas.id);
    const { student, progress, attemptId, analysis, competencies }: Evidence =
        absent.json();

    assert.equal(absent.statusCode, 200);
    assert.deepEqual(
        { student, progress, attemptId, analysis, competencies },
        {
            student: { id: demo.dimas.id, name: 'Dimas Saputra' },
            progress: 'not_started',
            attemptId: null,
            analysis: null,
            competencies: [],
        },
    );
});

test('the latest decision shows, while the AI estimate and every decision stay (FR-043, AT-10)', async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const c2 = await c2Of(app, demo);
    const verify = (payload: object) =>
        asTeacher(
            app,
            demo.teacherToken,
            'POST',
            `/assessments/${c2.id}/verifications`,
            payload,
        );
    const decided = [
        await verify({ decision: 'agree', note: '   ' }),
        await verify({ decision: 'unsure', note: 'Will ask again tomorrow.' }),
        await verify({
            decision: 'change',
            status: 'visible',
            note: 'Explained the equal parts when asked.',
        }),
    ];

    assert.deepEqual(
        decided.map((response) => {
            const { decision, status, note } = response.json();

            return [response.statusCode, decision, status, note];
        }),
        [
            [201, 'agree', 'developing', null],
            [201, 'unsure', 'needs_verification', 'Will ask again tomorrow.'],
            [201, 'change', 'visible', 'Explained the equal parts when asked.'],
        ],
    );

    const kept = await c2Of(app, demo);

    assert.equal(kept.status, 'developing');
    assert.deepEqual(kept.shown, { status: 'visible', decision: 'change' });
    assert.deepEqual(
        kept.verifications.map(({ decision }) => decision),
        ['change', 'unsure', 'agree'],
    );

    const results: Results = (await resultsOf(app, demo)).json();
    const cell = results.students[0]?.competencies.find(
        ({ assessmentId }) => assessmentId === c2.id,
    );

    assert.deepEqual([cell?.status, cell?.decision], ['visible', 'change']);
});

test('a verification is checked: a change names a status other than the estimate, and a note has a limit', async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const c2 = await c2Of(app, demo);
    const cases: [object, string][] = [
        [{ decision: 'change' }, 'status'],
        [{ decision: 'change', status: 'developing' }, 'status'],
        [{ decision: 'change', status: 'needs_verification' }, 'status'],
        [{ decision: 'agree', note: 'x'.repeat(501) }, 'note'],
    ];

    for (const [payload, field] of cases) {
        const response = await asTeacher(
            app,
            demo.teacherToken,
            'POST',
            `/assessments/${c2.id}/verifications`,
            payload,
        );

        assert.equal(response.statusCode, 400, JSON.stringify(payload));
        assert.equal(response.json().name, 'VALIDATION_ERROR');
        assert.equal(response.json().details[0].field, field);
    }

    const unknown = await asTeacher(
        app,
        demo.teacherToken,
        'POST',
        `/assessments/${c2.id}/verifications`,
        { decision: 'maybe' },
    );

    assert.equal(unknown.statusCode, 400);
    assert.deepEqual((await c2Of(app, demo)).verifications, []);
});

test('a failed or missing analysis can be started again, and only then (AT-12)', async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const retry = (attemptId: number) =>
        asTeacher(
            app,
            demo.teacherToken,
            'POST',
            `/attempts/${attemptId}/analysis`,
        );
    const runsOf = (attemptId: number) =>
        app.db
            .select({ status: analysisRuns.status })
            .from(analysisRuns)
            .where(eq(analysisRuns.attemptId, attemptId))
            .orderBy(asc(analysisRuns.id));

    await app.db
        .update(analysisRuns)
        .set({ status: 'failed', tries: 3, finishedAt: new Date() })
        .where(eq(analysisRuns.attemptId, demo.attempts.waiting));

    const restarted = await retry(demo.attempts.waiting);

    assert.equal(restarted.statusCode, 202);
    assert.deepEqual(restarted.json(), { analysis: 'queued' });
    assert.deepEqual(
        (await runsOf(demo.attempts.waiting)).map(({ status }) => status),
        ['failed', 'queued'],
    );

    for (const attemptId of [
        demo.attempts.waiting,
        demo.attempts.analysed,
        demo.attempts.working,
    ]) {
        const refused = await retry(attemptId);

        assert.equal(refused.statusCode, 409, `attempt ${attemptId}`);
        assert.equal(refused.json().name, 'ANALYSIS_NOT_RETRYABLE');
    }

    const eko = await demoStudent(app, demo.classId, 'Eko Prasetyo');
    const unanalysed = await takeDemo(app, eko.token, demo.assignmentId);

    await app.db
        .delete(analysisRuns)
        .where(eq(analysisRuns.attemptId, unanalysed));

    const first = await retry(unanalysed);

    assert.equal(first.statusCode, 202);
    assert.deepEqual(
        (await runsOf(unanalysed)).map(({ status }) => status),
        ['queued'],
    );

    const results: Results = (await resultsOf(app, demo)).json();

    assert.deepEqual(
        results.students
            .filter(({ progress }) => progress === 'submitted')
            .map(({ name, analysis }) => [name, analysis]),
        [
            ['Ayu Lestari', 'succeeded'],
            ['Bima Putra', 'queued'],
            ['Eko Prasetyo', 'queued'],
        ],
    );
});

test("another teacher's class, session, student, assessment, and attempt answer 404, and a student is refused (AT-11)", async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const c2 = await c2Of(app, demo);
    const other = await createUser(app);
    const otherToken = await loginAs(app, other.username);
    const elsewhere = await demoClass(app);
    const outsider = await demoStudent(app, elsewhere.classId, 'Fajar Nugroho');
    const calls: ['GET' | 'POST', string, object?][] = [
        ['GET', `/classes/${demo.classId}/assignments`],
        [
            'GET',
            `/classes/${demo.classId}/assignments/${demo.assignmentId}/results`,
        ],
        [
            'GET',
            `/classes/${demo.classId}/assignments/${demo.assignmentId}/students/${demo.ayu.id}`,
        ],
        ['POST', `/assessments/${c2.id}/verifications`, { decision: 'agree' }],
        ['POST', `/attempts/${demo.attempts.analysed}/analysis`],
    ];

    for (const [method, url, payload] of calls) {
        const response = await asTeacher(app, otherToken, method, url, payload);

        assert.equal(response.statusCode, 404, `${method} ${url}`);
        assert.equal(response.json().name, 'NOT_FOUND');
    }

    for (const url of [
        `/classes/${demo.classId}/assignments/${elsewhere.assignmentId}/results`,
        `/classes/${demo.classId}/assignments/${demo.assignmentId}/students/${outsider.id}`,
    ]) {
        const response = await asTeacher(app, demo.teacherToken, 'GET', url);

        assert.equal(response.statusCode, 404, url);
    }

    await app.db
        .delete(classMembers)
        .where(eq(classMembers.studentId, demo.ayu.id));

    const left = await evidenceFor(app, demo, demo.ayu.id);
    const verifyLeft = await asTeacher(
        app,
        demo.teacherToken,
        'POST',
        `/assessments/${c2.id}/verifications`,
        { decision: 'agree' },
    );

    assert.equal(left.statusCode, 404);
    assert.equal(verifyLeft.statusCode, 404);

    const asAStudent = await asTeacher(
        app,
        demo.bima.token,
        'GET',
        `/classes/${demo.classId}/assignments/${demo.assignmentId}/results`,
    );

    assert.equal(asAStudent.statusCode, 403);
});

type Overview = {
    needsVerification: number;
    unreviewed: number;
    waiting: number;
    missions: object[];
    checks: {
        classId: number;
        assignmentId: number;
        studentId: number;
        studentName: string;
        competencyCode: string;
        decision: string | null;
    }[];
};

test("the teacher's home counts what needs verification, what nobody has reviewed, and what waits for analysis", async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const overview = async () => {
        const response = await asTeacher(
            app,
            demo.teacherToken,
            'GET',
            '/teacher/overview',
        );

        assert.equal(response.statusCode, 200);

        const body: Overview = response.json();

        return body;
    };
    const before = await overview();

    assert.deepEqual(
        [before.needsVerification, before.unreviewed, before.waiting],
        [0, 3, 0],
    );
    assert.deepEqual(before.missions, [
        {
            classId: demo.classId,
            className: 'Kelas 4A',
            assignmentId: demo.assignmentId,
            title: demoModule.session.title,
            students: 4,
            submitted: 2,
            needsVerification: 0,
            unreviewed: 3,
            waiting: 0,
        },
    ]);
    assert.deepEqual(before.checks, []);

    const evidence: Evidence = (
        await evidenceFor(app, demo, demo.ayu.id)
    ).json();
    const decide = async (code: string, payload: object) => {
        const id = evidence.competencies.find(
            (competency) => competency.code === code,
        )?.assessment?.id;

        assert.ok(id, `${code} has an assessment`);

        const response = await asTeacher(
            app,
            demo.teacherToken,
            'POST',
            `/assessments/${id}/verifications`,
            payload,
        );

        assert.equal(response.statusCode, 201);
    };

    await decide('C1', { decision: 'agree' });
    await decide('C2', { decision: 'unsure' });
    await app.db
        .update(analysisRuns)
        .set({ status: 'failed', tries: 3, finishedAt: new Date() })
        .where(eq(analysisRuns.attemptId, demo.attempts.waiting));

    const after = await overview();

    assert.deepEqual(
        [after.needsVerification, after.unreviewed, after.waiting],
        [1, 1, 1],
    );
    assert.deepEqual(
        after.checks.map(
            ({
                classId,
                assignmentId,
                studentId,
                studentName,
                competencyCode,
                decision,
            }) => ({
                classId,
                assignmentId,
                studentId,
                studentName,
                competencyCode,
                decision,
            }),
        ),
        [
            {
                classId: demo.classId,
                assignmentId: demo.assignmentId,
                studentId: demo.ayu.id,
                studentName: 'Ayu Lestari',
                competencyCode: 'C2',
                decision: 'unsure',
            },
        ],
    );
});

test("another teacher's home shows none of these classes, and a student is refused", async (t) => {
    const app = await testApp(t);
    const demo = await classWithResults(t, app);
    const other = await createUser(app);
    const response = await asTeacher(
        app,
        await loginAs(app, other.username),
        'GET',
        '/teacher/overview',
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
        needsVerification: 0,
        unreviewed: 0,
        waiting: 0,
        missions: [],
        checks: [],
    });

    const asAStudent = await asTeacher(
        app,
        demo.bima.token,
        'GET',
        '/teacher/overview',
    );

    assert.equal(asAStudent.statusCode, 403);
});

test("a student's evidence names the diagram of each question and the diagrams of the help opened", async (t) => {
    const app = await testApp(t);
    const demo = await demoClass(app, false, drawnDemoModule);
    const student = await demoStudent(app, demo.classId, 'Eka Wati');

    await takeDemo(app, student.token, demo.assignmentId);

    const response = await asTeacher(
        app,
        demo.teacherToken,
        'GET',
        `/classes/${demo.classId}/assignments/${demo.assignmentId}/students/${student.id}`,
    );
    const body: {
        competencies: {
            code: string;
            questions: { diagram?: string; help: { diagrams?: string[] } }[];
        }[];
    } = response.json();

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
        body.competencies.map(({ code, questions }) => [
            code,
            questions.map(({ diagram, help }) => [diagram, help.diagrams]),
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
    assert.equal(response.body.includes('"shapes"'), false);
});

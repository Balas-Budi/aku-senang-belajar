import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    assignments,
    competencies,
    learningSessions,
    sessionBlocks,
} from '../src/db/schema.ts';
import { demoModule } from '../src/learning/demo-module.ts';
import type { PreparedModule } from '../src/learning/seed-module.ts';
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

type CheckBlock = Extract<PreparedModule['blocks'][number], { kind: 'check' }>;

const lastCheck = demoModule.blocks
    .filter((block): block is CheckBlock => block.kind === 'check')
    .at(-1);

assert.ok(lastCheck);

const extraModule: PreparedModule = {
    ...demoModule,
    blocks: [
        ...demoModule.blocks,
        {
            kind: 'extra_challenge',
            content: {
                ...lastCheck.content,
                prompt: 'Soal tambahan dari guru.',
            },
            competencies: ['C1'],
        },
    ],
};

const twoChecks: PreparedModule = {
    ...demoModule,
    blocks: demoModule.blocks.map((block) =>
        block.kind === 'check'
            ? { ...block, competencies: ['C1', 'C2'] }
            : block,
    ),
};

function asTeacher(
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

const judged = (status: (code: string) => string) =>
    verdicts((competency) => {
        const chosen = status(competency.code);

        return chosen === 'visible'
            ? {}
            : {
                  status: chosen,
                  evidence: chosen === 'not_observed' ? [] : refsOf(competency),
                  followUps: ['Bagian mana yang sama besar?'],
              };
    });

async function classWithResults(
    app: FastifyInstance,
    t: TestContext,
    prepared = demoModule,
) {
    const provider = await stubProvider(t, [
        judged((code) => (code === 'C1' ? 'developing' : 'visible')),
    ]);
    const demo = await demoClass(app, false, prepared);
    const wulan = await demoStudent(app, demo.classId, 'Wulan Sari');
    const bima = await demoStudent(app, demo.classId, 'Bima Putra');

    await runFor(
        app,
        await takeDemo(app, wulan.token, demo.assignmentId),
        provider.config,
    );

    const codes = await app.db
        .select({ id: competencies.id, code: competencies.code })
        .from(competencies)
        .innerJoin(
            learningSessions,
            eq(learningSessions.moduleId, competencies.moduleId),
        )
        .where(eq(learningSessions.id, demo.sessionId));
    const competencyOf = (code: string) => {
        const found = codes.find((row) => row.code === code);

        assert.ok(found, `competency ${code}`);

        return found.id;
    };
    const path = `/classes/${demo.classId}/follow-ups`;
    const create = (payload: object, token = demo.teacherToken) =>
        asTeacher(app, token, 'POST', path, {
            assignmentId: demo.assignmentId,
            ...payload,
        });

    return { ...demo, wulan, bima, competencyOf, path, create };
}

async function rightAnswer(app: FastifyInstance, blockId: number) {
    const [row] = await app.db
        .select({ content: sessionBlocks.content })
        .from(sessionBlocks)
        .where(eq(sessionBlocks.id, blockId));

    return (row.content as { answer: string }).answer;
}

test('a teacher plans a follow-up for chosen students of a mission of their own class (FR-047)', async (t) => {
    const app = await testApp(t);
    const { teacherToken, path, create, competencyOf, wulan, bima } =
        await classWithResults(app, t);
    const other = await demoClass(app);
    const stranger = await loginAs(app, (await createUser(app)).username);
    const c1 = competencyOf('C1');
    const plan = {
        kind: 'reinforce',
        competencyId: c1,
        studentIds: [wulan.id, bima.id],
        note: '  Coba lagi pelan-pelan, ya.  ',
    };

    assert.equal((await create(plan, stranger)).statusCode, 404);
    assert.equal((await create(plan, wulan.token)).statusCode, 403);
    assert.equal(
        (
            await asTeacher(app, teacherToken, 'POST', path, {
                ...plan,
                assignmentId: other.assignmentId,
            })
        ).statusCode,
        404,
    );

    for (const [payload, field] of [
        [{ ...plan, kind: 'enrich' }, 'competencyId'],
        [{ ...plan, competencyId: undefined }, 'competencyId'],
        [{ ...plan, studentIds: [] }, 'studentIds'],
        [{ ...plan, studentIds: [wulan.id, wulan.id] }, 'studentIds'],
        [{ ...plan, note: 'x'.repeat(301) }, 'note'],
    ] as const) {
        const refused = await create(payload);

        assert.equal(refused.statusCode, 400, JSON.stringify(payload));
        assert.equal(refused.json().details[0].field, field);
    }

    const outsider = await demoStudent(app, other.classId, 'Citra Dewi');
    const notMember = await create({ ...plan, studentIds: [outsider.id] });

    assert.equal(notMember.statusCode, 400);
    assert.equal(notMember.json().details[0].field, 'studentIds');

    const [foreign] = await app.db
        .select({ id: competencies.id })
        .from(competencies)
        .innerJoin(
            learningSessions,
            eq(learningSessions.moduleId, competencies.moduleId),
        )
        .where(eq(learningSessions.id, other.sessionId));
    const untaught = await create({ ...plan, competencyId: foreign.id });

    assert.equal(untaught.statusCode, 400);
    assert.equal(untaught.json().details[0].field, 'competencyId');

    const noExtra = await create({ kind: 'enrich', studentIds: [wulan.id] });

    assert.equal(noExtra.statusCode, 409);
    assert.equal(noExtra.json().name, 'NO_EXTRA');

    const noCheck = await create({
        ...plan,
        competencyId: competencyOf('C3'),
    });

    assert.equal(noCheck.statusCode, 409);
    assert.equal(noCheck.json().name, 'NO_QUESTIONS');

    const made = await create(plan);

    assert.equal(made.statusCode, 201);

    const { followUp } = made.json();

    assert.equal(followUp.kind, 'reinforce');
    assert.equal(followUp.note, 'Coba lagi pelan-pelan, ya.');
    assert.equal(followUp.doneAt, null);
    assert.equal(followUp.competency.code, 'C1');
    assert.deepEqual(
        followUp.students.map(
            ({ name, status, practice }: Record<string, unknown>) => ({
                name,
                status,
                done: (practice as { done: number }).done,
            }),
        ),
        [
            { name: 'Bima Putra', status: null, done: 0 },
            { name: 'Wulan Sari', status: 'developing', done: 0 },
        ],
    );
    assert.ok(followUp.students[0].practice.total >= 1);

    const talk = (
        await create({
            kind: 'discuss',
            competencyId: c1,
            studentIds: [wulan.id],
        })
    ).json().followUp;

    assert.equal(talk.note, null);
    assert.equal(talk.students[0].practice, null);

    const listed = (await asTeacher(app, teacherToken, 'GET', path)).json();

    assert.deepEqual(
        listed.followUps.map(({ id }: { id: number }) => id),
        [talk.id, followUp.id],
    );

    const closed = await asTeacher(
        app,
        teacherToken,
        'PUT',
        `${path}/${talk.id}`,
        { done: true },
    );

    assert.equal(closed.statusCode, 200);
    assert.ok(closed.json().followUp.doneAt);
    assert.equal(
        (
            await asTeacher(app, teacherToken, 'PUT', `${path}/${talk.id}`, {
                done: false,
            })
        ).json().followUp.doneAt,
        null,
    );
    assert.equal(
        (
            await asTeacher(
                app,
                other.teacherToken,
                'PUT',
                `/classes/${other.classId}/follow-ups/${talk.id}`,
                { done: true },
            )
        ).statusCode,
        404,
    );
});

test('reinforcement reaches the chosen students who did the mission, as practice that ends the follow-up for them (FR-047)', async (t) => {
    const app = await testApp(t);
    const {
        teacherToken,
        path,
        create,
        competencyOf,
        wulan,
        bima,
        assignmentId,
    } = await classWithResults(app, t, twoChecks);
    const c1 = competencyOf('C1');
    const followUp = (
        await create({
            kind: 'reinforce',
            competencyId: c1,
            studentIds: [wulan.id, bima.id],
            note: 'Latihan lagi, ya.',
        })
    ).json().followUp;

    await create({ kind: 'reteach', competencyId: c1, studentIds: [wulan.id] });

    const list = (
        await asStudent(
            app,
            wulan.token,
            'GET',
            '/follow-ups?subject=mathematics',
        )
    ).json();

    assert.equal(list.followUps.length, 1);
    assert.deepEqual(
        { ...list.followUps[0], practice: undefined },
        {
            id: followUp.id,
            kind: 'reinforce',
            mission: list.followUps[0].mission,
            competency: list.followUps[0].competency,
            note: 'Latihan lagi, ya.',
            practice: undefined,
        },
    );
    assert.ok(list.followUps[0].competency.length > 0);
    assert.deepEqual(
        (
            await asStudent(
                app,
                wulan.token,
                'GET',
                '/follow-ups?subject=natural_and_social_science',
            )
        ).json().followUps,
        [],
    );
    assert.deepEqual(
        (
            await asStudent(
                app,
                bima.token,
                'GET',
                '/follow-ups?subject=mathematics',
            )
        ).json().followUps,
        [],
    );
    assert.equal(
        (await asStudent(app, bima.token, 'GET', `/follow-ups/${followUp.id}`))
            .statusCode,
        404,
    );

    const detail = (
        await asStudent(app, wulan.token, 'GET', `/follow-ups/${followUp.id}`)
    ).json();

    assert.equal(detail.followUp.subject, 'mathematics');
    assert.ok(detail.questions.length >= 1);
    assert.equal(detail.questions.length, followUp.students[0].practice.total);
    assert.ok(!('answer' in detail.questions[0].content));

    const [blocks] = await app.db
        .select({ id: sessionBlocks.id })
        .from(sessionBlocks)
        .innerJoin(
            assignments,
            eq(assignments.learningSessionId, sessionBlocks.learningSessionId),
        )
        .where(
            and(
                eq(assignments.id, assignmentId),
                eq(sessionBlocks.kind, 'reflection'),
            ),
        );
    const send = (blockId: number, tryNumber: number, choice: string) =>
        asStudent(
            app,
            wulan.token,
            'POST',
            `/follow-ups/${followUp.id}/tries`,
            {
                blockId,
                tryNumber,
                answer: {
                    kind: 'check',
                    choice,
                    reason: 'Karena potongannya sama besar',
                },
            },
        );
    const first = detail.questions[0].id;
    const right = await rightAnswer(app, first);
    const wrong = ['a', 'b', 'c', 'd'].find((id) => id !== right) ?? 'a';

    assert.equal((await send(blocks.id, 1, 'a')).statusCode, 404);
    assert.equal(
        (await send(first, 2, right)).json().details[0].field,
        'tryNumber',
    );

    const missed = await send(first, 1, wrong);

    assert.equal(missed.statusCode, 201);
    assert.equal(missed.json().outcome, 'not_yet');

    for (const [index, question] of detail.questions.entries()) {
        const tryNumber = question.id === first ? 2 : 1;
        const answered = await send(
            question.id,
            tryNumber,
            await rightAnswer(app, question.id),
        );

        assert.equal(answered.json().outcome, 'correct');

        if (index + 1 < detail.questions.length) {
            assert.deepEqual(
                (
                    await asStudent(
                        app,
                        wulan.token,
                        'GET',
                        `/follow-ups/${followUp.id}`,
                    )
                )
                    .json()
                    .questions.map(({ id }: { id: number }) => id),
                detail.questions
                    .slice(index + 1)
                    .map(({ id }: { id: number }) => id),
            );
        }
    }

    assert.ok(detail.questions.length >= 2, 'C1 has two checks to practise');

    assert.deepEqual(
        (
            await asStudent(
                app,
                wulan.token,
                'GET',
                '/follow-ups?subject=mathematics',
            )
        ).json().followUps,
        [],
    );
    assert.equal(
        (await asStudent(app, wulan.token, 'GET', `/follow-ups/${followUp.id}`))
            .statusCode,
        404,
    );

    const seen = (await asTeacher(app, teacherToken, 'GET', path)).json()
        .followUps;
    const practised = seen.find(({ id }: { id: number }) => id === followUp.id);
    const total = detail.questions.length;

    assert.deepEqual(
        practised.students.map(
            ({ name, practice }: { name: string; practice: object }) => ({
                name,
                practice,
            }),
        ),
        [
            { name: 'Bima Putra', practice: { done: 0, total, right: 0 } },
            {
                name: 'Wulan Sari',
                practice: { done: total, total, right: total },
            },
        ],
    );

    const again = (
        await create({
            kind: 'reinforce',
            competencyId: c1,
            studentIds: [wulan.id],
        })
    ).json().followUp;

    assert.equal(
        (
            await asStudent(
                app,
                wulan.token,
                'GET',
                '/follow-ups?subject=mathematics',
            )
        ).json().followUps.length,
        1,
    );

    await asTeacher(app, teacherToken, 'PUT', `${path}/${again.id}`, {
        done: true,
    });
    assert.deepEqual(
        (
            await asStudent(
                app,
                wulan.token,
                'GET',
                '/follow-ups?subject=mathematics',
            )
        ).json().followUps,
        [],
    );
});

test('enrichment offers the mission extra challenge to the chosen students whatever their statuses, and the results say a mission has one (FR-047)', async (t) => {
    const app = await testApp(t);
    const { teacherToken, create, wulan, classId, assignmentId } =
        await classWithResults(app, t, extraModule);
    const results = await asTeacher(
        app,
        teacherToken,
        'GET',
        `/classes/${classId}/assignments/${assignmentId}/results`,
    );

    assert.equal(results.json().extra, true);
    assert.deepEqual(
        (
            await asStudent(
                app,
                wulan.token,
                'GET',
                '/extra?subject=mathematics',
            )
        ).json().extra,
        null,
    );

    const enrich = (
        await create({ kind: 'enrich', studentIds: [wulan.id] })
    ).json().followUp;

    assert.equal(enrich.competency, null);
    assert.deepEqual(enrich.students[0], {
        id: wulan.id,
        name: 'Wulan Sari',
        status: null,
        practice: { done: 0, total: 1, right: 0 },
    });

    const detail = (
        await asStudent(app, wulan.token, 'GET', `/follow-ups/${enrich.id}`)
    ).json();

    assert.equal(detail.followUp.kind, 'enrich');
    assert.equal(detail.questions.length, 1);
    assert.equal(
        detail.questions[0].content.prompt,
        'Soal tambahan dari guru.',
    );

    const extraId = detail.questions[0].id;
    const right = await rightAnswer(app, extraId);
    const wrong = right === 'a' ? 'b' : 'a';

    for (const tryNumber of [1, 2, 3]) {
        const sent = await asStudent(
            app,
            wulan.token,
            'POST',
            `/follow-ups/${enrich.id}/tries`,
            {
                blockId: extraId,
                tryNumber,
                answer: { kind: 'check', choice: wrong },
            },
        );

        assert.equal(sent.statusCode, 201);
    }

    assert.equal(
        (await asStudent(app, wulan.token, 'GET', `/follow-ups/${enrich.id}`))
            .statusCode,
        404,
    );

    const after = (
        await asTeacher(
            app,
            teacherToken,
            'GET',
            `/classes/${classId}/follow-ups`,
        )
    ).json().followUps[0];

    assert.deepEqual(after.students[0].practice, {
        done: 1,
        total: 1,
        right: 0,
    });

    const plain = await demoClass(app);
    const [none] = await app.db
        .select({ id: assignments.id })
        .from(assignments)
        .where(inArray(assignments.id, [plain.assignmentId]));

    assert.equal(
        (
            await asTeacher(
                app,
                plain.teacherToken,
                'GET',
                `/classes/${plain.classId}/assignments/${none.id}/results`,
            )
        ).json().extra,
        false,
    );
});

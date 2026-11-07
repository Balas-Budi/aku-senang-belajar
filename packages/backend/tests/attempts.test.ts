import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    assignments,
    classMembers,
    helpEvents,
    learningSessions,
    responses,
} from '../src/db/schema.ts';
import {
    type PreparedModule,
    seedModule,
} from '../src/learning/seed-module.ts';
import {
    createClass,
    createStudent,
    createUser,
    loginAs,
    TEST_ORIGIN,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';

const lesson: PreparedModule = {
    subject: 'mathematics',
    material: 'Fractions book',
    module: 'Fractions',
    competencies: [
        { code: 'C1', description: 'Recognise a quarter' },
        { code: 'C2', description: 'Explain a quarter' },
    ],
    session: { title: 'Equal parts', summary: 'When is a piece a quarter?' },
    blocks: [
        {
            kind: 'hook',
            content: {
                prompt: 'Which way of sharing is fair?',
                options: [
                    { id: 'a', label: 'A' },
                    { id: 'b', label: 'B' },
                ],
            },
            competencies: ['C1'],
        },
        {
            kind: 'story',
            content: {
                text: 'Four equal parts are quarters.',
                illustration: 'loaf-quarters',
            },
            competencies: ['C1'],
        },
        {
            kind: 'check',
            content: {
                prompt: 'Is one of these unequal pieces a quarter?',
                options: [
                    { id: 'a', label: 'Yes' },
                    { id: 'b', label: 'No' },
                ],
                answer: 'b',
                reason: { prompt: 'Why?', starters: ['Because ...'] },
                praise: 'Right, the parts must be equal.',
                hints: [
                    { text: 'The first hint.' },
                    { text: 'The second hint.' },
                    { text: 'The third hint.' },
                ],
                example: { text: 'A sheet folded into four equal parts.' },
                reveal: 'No, because the pieces are not equal.',
            },
            competencies: ['C2'],
        },
        {
            kind: 'challenge',
            content: {
                prompt: 'Ani takes 1/4 of a bread and Budi takes 1/2.',
                question: 'Who gets more? Explain why.',
                options: [
                    { id: 'a', label: 'Ani' },
                    { id: 'b', label: 'Budi' },
                ],
                answer: 'b',
                reasonStarter: 'I think ... because ...',
            },
            competencies: ['C2'],
        },
        {
            kind: 'reflection',
            content: {
                topics: ['What 1/4 means', 'Equal parts', 'Comparing'],
                takeaways: ['A quarter is one of four equal parts.'],
            },
            competencies: ['C1', 'C2'],
        },
    ],
};

const firstHint = { text: 'The first hint.' };
const secondHint = { text: 'The second hint.' };
const nothingEarned = { hints: [], example: null, praise: null, reveal: null };

async function newClass(app: FastifyInstance) {
    const teacher = await createUser(app);
    const classroom = await createClass(
        app,
        await loginAs(app, teacher.username),
    );

    return classroom.id;
}

async function assignLesson(app: FastifyInstance, classId: number) {
    const { sessionId } = await seedModule(app.db, classId, {
        ...lesson,
        material: `Lesson ${randomUUID()}`,
    });
    const [assignment] = await app.db
        .select({ id: assignments.id })
        .from(assignments)
        .where(
            and(
                eq(assignments.learningSessionId, sessionId),
                eq(assignments.classId, classId),
            ),
        );

    return { sessionId, assignmentId: assignment.id };
}

async function studentIn(app: FastifyInstance, classId: number) {
    const student = await createStudent(app);

    await app.db
        .insert(classMembers)
        .values({ studentId: student.id, classId });

    return loginAs(app, student.username, TEST_STUDENT_PASSWORD);
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
        url: `/api/student${url}`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload,
    });
}

async function startedLesson(app: FastifyInstance) {
    const classId = await newClass(app);
    const { assignmentId } = await assignLesson(app, classId);
    const token = await studentIn(app, classId);
    const detail: { blocks: { id: number; kind: string }[] } = (
        await call(app, token, 'GET', `/assignments/${assignmentId}`)
    ).json();
    const attempt: { id: number } = (
        await call(app, token, 'POST', `/assignments/${assignmentId}/attempt`)
    ).json();
    const blockId = (kind: string) => {
        const block = detail.blocks.find((entry) => entry.kind === kind);

        if (!block) {
            throw new Error(`The lesson has no ${kind} block`);
        }

        return block.id;
    };

    return { classId, assignmentId, token, attemptId: attempt.id, blockId };
}

async function helpKinds(app: FastifyInstance, attemptId: number) {
    const rows = await app.db
        .select({ kind: helpEvents.kind })
        .from(helpEvents)
        .where(eq(helpEvents.attemptId, attemptId))
        .orderBy(asc(helpEvents.id));

    return rows.map(({ kind }) => kind);
}

test('a student reads an assigned session without its answers, hints, praise, or reveal', async (t) => {
    const app = await testApp(t);
    const classId = await newClass(app);
    const { assignmentId } = await assignLesson(app, classId);
    const token = await studentIn(app, classId);

    const response = await call(
        app,
        token,
        'GET',
        `/assignments/${assignmentId}`,
    );
    const body: {
        title: string;
        attempt: null;
        blocks: {
            kind: string;
            step: string;
            content: object;
            earned?: object;
        }[];
    } = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.title, 'Equal parts');
    assert.equal(body.attempt, null);
    assert.deepEqual(
        body.blocks.map(({ kind, step }) => [kind, step]),
        [
            ['hook', 'opening'],
            ['story', 'story'],
            ['check', 'story'],
            ['challenge', 'challenge'],
            ['reflection', 'reflection'],
        ],
    );
    assert.deepEqual(Object.keys(body.blocks[2].content).sort(), [
        'options',
        'prompt',
        'reason',
    ]);
    assert.deepEqual(body.blocks[2].earned, nothingEarned);
    assert.deepEqual(Object.keys(body.blocks[3].content).sort(), [
        'options',
        'prompt',
        'question',
        'reasonStarter',
    ]);
    assert.deepEqual(Object.keys(body.blocks[4].content), ['topics']);

    for (const secret of [
        'Right, the parts',
        'hint.',
        'folded into four',
        'not equal.',
        'A quarter is one',
    ]) {
        assert.equal(response.body.includes(secret), false, secret);
    }
});

test('a draft session, another class session, and another student attempt answer 404 (AT-03, AT-11)', async (t) => {
    const app = await testApp(t);
    const classId = await newClass(app);
    const draft = await assignLesson(app, classId);
    const other = await assignLesson(app, await newClass(app));
    const mine = await startedLesson(app);
    const classmate = await studentIn(app, mine.classId);

    await app.db
        .update(learningSessions)
        .set({ status: 'draft' })
        .where(eq(learningSessions.id, draft.sessionId));

    const token = await studentIn(app, classId);
    const answers = [
        await call(app, token, 'GET', `/assignments/${draft.assignmentId}`),
        await call(
            app,
            token,
            'POST',
            `/assignments/${draft.assignmentId}/attempt`,
        ),
        await call(app, token, 'GET', `/assignments/${other.assignmentId}`),
        await call(
            app,
            classmate,
            'PUT',
            `/attempts/${mine.attemptId}/checkpoint`,
            { blockId: mine.blockId('story') },
        ),
        await call(
            app,
            classmate,
            'POST',
            `/attempts/${mine.attemptId}/responses`,
            {
                blockId: mine.blockId('hook'),
                tryNumber: 1,
                answer: { kind: 'hook', choice: 'a' },
            },
        ),
        await call(
            app,
            classmate,
            'POST',
            `/attempts/${mine.attemptId}/submit`,
        ),
    ];

    assert.deepEqual(
        answers.map((response) => [response.statusCode, response.json().name]),
        Array.from({ length: 6 }, () => [404, 'NOT_FOUND']),
    );
});

test('starting twice resumes the same attempt at the first block', async (t) => {
    const app = await testApp(t);
    const classId = await newClass(app);
    const { assignmentId } = await assignLesson(app, classId);
    const token = await studentIn(app, classId);
    const detail: { blocks: { id: number }[] } = (
        await call(app, token, 'GET', `/assignments/${assignmentId}`)
    ).json();

    const first = await call(
        app,
        token,
        'POST',
        `/assignments/${assignmentId}/attempt`,
    );
    const again = await call(
        app,
        token,
        'POST',
        `/assignments/${assignmentId}/attempt`,
    );

    assert.equal(first.statusCode, 201);
    assert.deepEqual(first.json(), {
        id: first.json().id,
        status: 'in_progress',
        checkpoint: detail.blocks[0].id,
        answers: [],
        done: null,
    });
    assert.equal(again.statusCode, 200);
    assert.deepEqual(again.json(), first.json());
});

test('each answer to a check that is not yet right brings the next hint, and the third brings the answer with its reason (AT-05)', async (t) => {
    const app = await testApp(t);
    const { token, attemptId, blockId } = await startedLesson(app);
    const tryAgain = (tryNumber: number) =>
        call(app, token, 'POST', `/attempts/${attemptId}/responses`, {
            blockId: blockId('check'),
            tryNumber,
            answer: { kind: 'check', choice: 'a', reason: 'They look alike' },
        });

    const first = await tryAgain(1);
    const second = await tryAgain(2);
    const third = await tryAgain(3);

    assert.equal(first.statusCode, 201);
    assert.deepEqual(first.json(), {
        outcome: 'not_yet',
        earned: { ...nothingEarned, hints: [firstHint] },
    });
    assert.deepEqual(second.json().earned.hints, [firstHint, secondHint]);
    assert.deepEqual(third.json(), {
        outcome: 'not_yet',
        earned: {
            ...nothingEarned,
            hints: [firstHint, secondHint],
            reveal: {
                answer: 'b',
                text: 'No, because the pieces are not equal.',
            },
        },
    });
    assert.deepEqual(await helpKinds(app, attemptId), [
        'hint',
        'hint',
        'reveal',
    ]);
});

test('a right answer earns the praise and closes the check', async (t) => {
    const app = await testApp(t);
    const { token, attemptId, blockId } = await startedLesson(app);
    const answer = (tryNumber: number, choice: string) =>
        call(app, token, 'POST', `/attempts/${attemptId}/responses`, {
            blockId: blockId('check'),
            tryNumber,
            answer: { kind: 'check', choice, reason: 'The pieces differ' },
        });

    const right = await answer(1, 'b');
    const more = await answer(2, 'a');

    assert.equal(right.statusCode, 201);
    assert.deepEqual(right.json(), {
        outcome: 'correct',
        earned: { ...nothingEarned, praise: 'Right, the parts must be equal.' },
    });
    assert.equal(more.statusCode, 409);
    assert.equal(more.json().name, 'ALREADY_ANSWERED');
});

test('an answer sent twice is stored once', async (t) => {
    const app = await testApp(t);
    const { token, attemptId, blockId } = await startedLesson(app);
    const payload = {
        blockId: blockId('check'),
        tryNumber: 1,
        answer: { kind: 'check', choice: 'a', reason: 'Same size' },
    };

    const first = await call(
        app,
        token,
        'POST',
        `/attempts/${attemptId}/responses`,
        payload,
    );
    const resent = await call(
        app,
        token,
        'POST',
        `/attempts/${attemptId}/responses`,
        payload,
    );
    const stored = await app.db
        .select({ id: responses.id })
        .from(responses)
        .where(eq(responses.attemptId, attemptId));

    assert.equal(first.statusCode, 201);
    assert.equal(resent.statusCode, 200);
    assert.deepEqual(resent.json(), first.json());
    assert.equal(stored.length, 1);
    assert.deepEqual(await helpKinds(app, attemptId), ['hint']);
});

test('leaving and coming back keeps the checkpoint and the saved answers (AT-06)', async (t) => {
    const app = await testApp(t);
    const { token, assignmentId, attemptId, blockId } =
        await startedLesson(app);

    await call(app, token, 'POST', `/attempts/${attemptId}/responses`, {
        blockId: blockId('hook'),
        tryNumber: 1,
        answer: { kind: 'hook', choice: 'a' },
    });
    const moved = await call(
        app,
        token,
        'PUT',
        `/attempts/${attemptId}/checkpoint`,
        { blockId: blockId('check') },
    );
    await call(app, token, 'POST', `/attempts/${attemptId}/responses`, {
        blockId: blockId('check'),
        tryNumber: 1,
        answer: { kind: 'check', choice: 'a', reason: 'Same size' },
    });

    const back = (
        await call(app, token, 'GET', `/assignments/${assignmentId}`)
    ).json();

    assert.equal(moved.statusCode, 204);
    assert.equal(back.attempt.checkpoint, blockId('check'));
    assert.deepEqual(back.attempt.answers, [
        {
            blockId: blockId('hook'),
            tryNumber: 1,
            answer: { kind: 'hook', choice: 'a' },
            outcome: 'accepted',
        },
        {
            blockId: blockId('check'),
            tryNumber: 1,
            answer: { kind: 'check', choice: 'a', reason: 'Same size' },
            outcome: 'not_yet',
        },
    ]);
    assert.deepEqual(back.blocks[2].earned.hints, [firstHint]);
});

test('hints and the other example come only when asked, and asking the teacher is recorded', async (t) => {
    const app = await testApp(t);
    const { token, attemptId, blockId } = await startedLesson(app);
    const help = (block: string, kind: string) =>
        call(app, token, 'POST', `/attempts/${attemptId}/help`, {
            blockId: blockId(block),
            kind,
        });

    const hint = await help('check', 'hint');
    const example = await help('check', 'example');
    const teacher = await help('story', 'ask_teacher');
    const storyHint = await help('story', 'hint');
    await help('check', 'hint');
    await help('check', 'hint');
    const fourthHint = await help('check', 'hint');

    assert.equal(hint.statusCode, 201);
    assert.deepEqual(hint.json().earned.hints, [firstHint]);
    assert.deepEqual(example.json().earned.example, {
        text: 'A sheet folded into four equal parts.',
    });
    assert.deepEqual(teacher.json(), { earned: null });
    assert.equal(storyHint.statusCode, 400);
    assert.equal(storyHint.json().details[0].field, 'kind');
    assert.equal(fourthHint.statusCode, 400);
    assert.equal(fourthHint.json().details[0].field, 'kind');
    assert.deepEqual(await helpKinds(app, attemptId), [
        'hint',
        'example',
        'ask_teacher',
        'hint',
        'hint',
    ]);
});

test('an answer must fit its block: a needed reason, a typed challenge reason, and choices from the options (AT-07)', async (t) => {
    const app = await testApp(t);
    const { token, attemptId, blockId } = await startedLesson(app);
    const answer = (payload: object) =>
        call(app, token, 'POST', `/attempts/${attemptId}/responses`, payload);

    const refused = [
        await answer({
            blockId: blockId('check'),
            tryNumber: 1,
            answer: { kind: 'check', choice: 'b' },
        }),
        await answer({
            blockId: blockId('check'),
            tryNumber: 1,
            answer: { kind: 'check', choice: 'z', reason: 'A guess' },
        }),
        await answer({
            blockId: blockId('check'),
            tryNumber: 1,
            answer: { kind: 'hook', choice: 'a' },
        }),
        await answer({
            blockId: blockId('challenge'),
            tryNumber: 1,
            answer: { kind: 'challenge', choice: 'b' },
        }),
        await answer({
            blockId: blockId('reflection'),
            tryNumber: 1,
            answer: {
                kind: 'reflection',
                understood: ['Something else'],
                confusing: [],
            },
        }),
    ];
    const typed = await answer({
        blockId: blockId('challenge'),
        tryNumber: 1,
        answer: {
            kind: 'challenge',
            choice: 'b',
            reason: 'A half is bigger than a quarter',
        },
    });

    assert.deepEqual(
        refused.map((response) => [
            response.statusCode,
            response.json().details[0].field,
        ]),
        [
            [400, 'answer/reason'],
            [400, 'answer/choice'],
            [400, 'answer/kind'],
            [400, 'answer/reason'],
            [400, 'answer/understood'],
        ],
    );
    assert.equal(typed.statusCode, 201);
    assert.deepEqual(typed.json(), { outcome: 'accepted', earned: null });
});

test('finishing returns the takeaways and the topics to practise, and the attempt takes no more answers', async (t) => {
    const app = await testApp(t);
    const { token, assignmentId, attemptId, blockId } =
        await startedLesson(app);

    await call(app, token, 'POST', `/attempts/${attemptId}/responses`, {
        blockId: blockId('reflection'),
        tryNumber: 1,
        answer: {
            kind: 'reflection',
            understood: ['Equal parts'],
            confusing: ['Comparing'],
        },
    });
    const done = await call(
        app,
        token,
        'POST',
        `/attempts/${attemptId}/submit`,
    );
    const again = await call(
        app,
        token,
        'POST',
        `/attempts/${attemptId}/submit`,
    );
    const late = await call(
        app,
        token,
        'POST',
        `/attempts/${attemptId}/responses`,
        {
            blockId: blockId('hook'),
            tryNumber: 1,
            answer: { kind: 'hook', choice: 'a' },
        },
    );
    const detail = (
        await call(app, token, 'GET', `/assignments/${assignmentId}`)
    ).json();

    assert.equal(done.statusCode, 200);
    assert.deepEqual(done.json(), {
        takeaways: ['A quarter is one of four equal parts.'],
        toPractise: ['Comparing'],
    });
    assert.deepEqual(again.json(), done.json());
    assert.equal(late.statusCode, 409);
    assert.equal(late.json().name, 'ALREADY_SUBMITTED');
    assert.equal(detail.attempt.status, 'submitted');
    assert.deepEqual(detail.attempt.done, done.json());
});

test('the learning path shows each session progress and step (FR-016)', async (t) => {
    const app = await testApp(t);
    const classId = await newClass(app);
    const { assignmentId } = await assignLesson(app, classId);
    const token = await studentIn(app, classId);
    const progress = async () => {
        const path: {
            subjects: {
                chapters: {
                    stages: { progress: string; step: string | null }[];
                }[];
            }[];
        } = (await call(app, token, 'GET', '/path')).json();

        return path.subjects
            .flatMap(({ chapters }) => chapters)
            .flatMap(({ stages }) => stages)
            .map(({ progress: status, step }) => [status, step]);
    };

    const before = await progress();
    const attempt: { id: number } = (
        await call(app, token, 'POST', `/assignments/${assignmentId}/attempt`)
    ).json();
    const started = await progress();
    const detail: { blocks: { id: number; kind: string }[] } = (
        await call(app, token, 'GET', `/assignments/${assignmentId}`)
    ).json();
    const challenge = detail.blocks.find((block) => block.kind === 'challenge');

    await call(app, token, 'PUT', `/attempts/${attempt.id}/checkpoint`, {
        blockId: challenge?.id,
    });
    const later = await progress();
    await call(app, token, 'POST', `/attempts/${attempt.id}/submit`);
    const finished = await progress();

    assert.deepEqual(before, [['not_started', null]]);
    assert.deepEqual(started, [['in_progress', 'opening']]);
    assert.deepEqual(later, [['in_progress', 'challenge']]);
    assert.deepEqual(finished, [['submitted', null]]);
});

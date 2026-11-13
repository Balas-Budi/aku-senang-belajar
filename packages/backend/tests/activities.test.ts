import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    answerProblem,
    answerWords,
    inPlace,
    sessionBlock,
    taskWords,
    themeProblems,
    type Activity,
} from '../src/learning/blocks.ts';
import { demoModule } from '../src/learning/demo-module.ts';
import type { PreparedModule } from '../src/learning/seed-module.ts';
import {
    checkDraft,
    SESSION_SYSTEM_PROMPT,
    sessionDraft,
} from '../src/studio/session-draft.ts';
import { THEME_SYSTEM_PROMPT } from '../src/studio/theme-draft.ts';
import { stubProvider } from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    runFor,
    verdicts,
} from './demo-attempts.ts';
import { testApp } from './helpers.ts';
import { draft, drawnDraft } from './studio-fixtures.ts';

type Block = PreparedModule['blocks'][number];
type CheckBlock = Extract<Block, { kind: 'check' }>;

const firstCheck = demoModule.blocks.find(
    (block): block is CheckBlock => block.kind === 'check',
);

assert.ok(firstCheck, 'the demo has a check');

const order: Activity = {
    type: 'order',
    cards: [
        { id: 'a', label: '1/2' },
        { id: 'b', label: '1/8' },
        { id: 'c', label: '1/4' },
    ],
};
const match: Activity = {
    type: 'match',
    places: [
        { id: 'p', label: 'Setengah' },
        { id: 'q', label: 'Seperempat' },
    ],
    cards: [
        { id: 'a', label: '1/4' },
        { id: 'b', label: '1/2' },
    ],
};
const group: Activity = {
    type: 'group',
    places: [
        { id: 'p', label: 'Sama besar' },
        { id: 'q', label: 'Tidak sama besar' },
    ],
    cards: [
        { id: 'a', label: 'Roti A' },
        { id: 'b', label: 'Roti B' },
        { id: 'c', label: 'Roti C' },
        { id: 'd', label: 'Roti D' },
    ],
};
const shade: Activity = { type: 'shade', shape: 'bar', parts: 4 };

const checkWith = (given: Activity, answer: string, extra: object = {}) => ({
    kind: 'check',
    content: {
        ...firstCheck.content,
        options: undefined,
        activity: given,
        answer,
        ...extra,
    },
});

const problemsOf = (value: object) => {
    const parsed = sessionBlock.safeParse(value);

    return parsed.success
        ? []
        : parsed.error.issues.map(
              ({ path, message }) => `${path.slice(1).join('.')}: ${message}`,
          );
};

test('a check holds options or an activity, and an activity answer must be complete (FR-030)', () => {
    assert.deepEqual(problemsOf(checkWith(order, 'b,c,a')), []);
    assert.deepEqual(problemsOf(checkWith(match, 'a:q,b:p')), []);
    assert.deepEqual(problemsOf(checkWith(group, 'a:p,b:q,c:p,d:q')), []);
    assert.deepEqual(problemsOf(checkWith(shade, '1')), []);

    assert.deepEqual(
        problemsOf(
            checkWith(order, 'b,c,a', {
                options: firstCheck.content.options,
            }),
        ),
        ['options: A check with an activity has no options'],
    );
    assert.deepEqual(
        problemsOf({
            kind: 'check',
            content: { ...firstCheck.content, options: undefined },
        }),
        ['options: A check needs options or an activity'],
    );
    assert.deepEqual(problemsOf(checkWith(order, 'b,c')), [
        'answer: must list every card id once, in order, such as "c,a,b"',
    ]);
    assert.deepEqual(problemsOf(checkWith(order, 'a,b,c')), [
        'activity: lists the cards in the right order; list them mixed, since the student sees this order',
    ]);
    assert.deepEqual(problemsOf(checkWith(match, 'a:p,b:p')), [
        'answer: must give each place exactly one card',
    ]);
    assert.deepEqual(problemsOf(checkWith(match, 'b:p,a:q')), [
        'answer: must give every card a place, sorted by card id, such as "a:q,b:p"',
    ]);
    assert.deepEqual(problemsOf(checkWith(group, 'a:p,b:p,c:p,d:p')), [
        'answer: must put at least one card in every place',
    ]);
    assert.deepEqual(problemsOf(checkWith(shade, '0')), [
        'answer: must shade at least one part',
    ]);
    assert.deepEqual(problemsOf(checkWith(shade, '5')), [
        'answer: must be how many of the 4 parts are shaded, such as "1"',
    ]);
});

test('an answer is counted and worded for the evidence', () => {
    assert.equal(answerProblem(group, 'a:p,b:p,c:p,d:p'), null);
    assert.equal(answerProblem(shade, '0'), null);
    assert.equal(inPlace(order, 'b,a,c', 'b,c,a'), 1);
    assert.equal(inPlace(group, 'a:p,b:p,c:p,d:q', 'a:p,b:q,c:p,d:q'), 3);
    assert.equal(inPlace(shade, '2', '1'), null);

    assert.equal(taskWords(order), 'Mengurutkan kartu "1/2", "1/8", "1/4"');
    assert.equal(answerWords(order, 'b,c,a'), '"1/8", "1/4", "1/2"');
    assert.equal(
        taskWords(match),
        'Memasangkan kartu "1/4", "1/2" ke "Setengah", "Seperempat"',
    );
    assert.equal(
        answerWords(match, 'a:q,b:p'),
        '"Setengah": "1/2"; "Seperempat": "1/4"',
    );
    assert.equal(
        answerWords(group, 'a:p,b:p,c:p,d:p'),
        '"Sama besar": "Roti A", "Roti B", "Roti C", "Roti D"; "Tidak sama besar": kosong',
    );
    assert.equal(
        taskWords(shade),
        'Mengarsir bagian dari persegi panjang yang dibagi 4 sama besar',
    );
    assert.equal(answerWords(shade, '3'), '3 dari 4 bagian diarsir');
});

test('a theme rewrites the labels of an activity and keeps its type, ids, and answer', () => {
    const base = sessionBlock.parse(checkWith(order, 'b,c,a'));
    const relabelled = sessionBlock.parse(
        checkWith(
            {
                ...order,
                cards: order.cards.map((card) => ({ ...card })),
            },
            'b,c,a',
        ),
    );
    const reordered = sessionBlock.parse(checkWith(order, 'c,b,a'));
    const fewer = sessionBlock.parse(
        checkWith({ type: 'shade', shape: 'bar', parts: 4 }, '1'),
    );

    assert.deepEqual(themeProblems(base, relabelled), []);
    assert.deepEqual(themeProblems(base, reordered), [
        'Theme rule: Keep the answer b,c,a',
    ]);
    assert.ok(
        themeProblems(base, fewer).includes(
            "Theme rule: Keep the activity's type, cards, places, and their ids; change only the labels",
        ),
    );
});

test('a draft may give a check an activity, and the draft check reads it like any screen', () => {
    const withActivity = (answer: string) =>
        sessionDraft.parse({
            ...draft,
            blocks: draft.blocks.map((block, index) =>
                index === 2
                    ? {
                          ...block,
                          content: {
                              ...block.content,
                              options: undefined,
                              activity: order,
                              answer,
                          },
                      }
                    : block,
            ),
        });
    const check = checkDraft(['C1', 'C2'], [1, 3, 4]);

    const plain = sessionDraft.parse(draft);

    assert.equal(check(withActivity('b,c,a')), null);
    assert.equal(
        check({
            ...plain,
            blocks: plain.blocks.map((block, index) =>
                index === 4 ? plain.blocks[2] : block,
            ),
        }),
        'No check has an "activity": give one check an "activity" in place of its "options" (order, match, group, or shade, whichever fits what it tests), with the solution as its "answer"',
    );
    assert.equal(
        checkDraft(
            ['C1', 'C2'],
            [1, 3, 4],
            null,
            false,
        )({
            ...plain,
            blocks: plain.blocks.map((block, index) =>
                index === 4 ? plain.blocks[2] : block,
            ),
        }),
        'No check has an "activity": give one check an "activity" in place of its "options" (order, match, or group, whichever fits what it tests), with the solution as its "answer"',
    );
    assert.equal(
        check(withActivity('a,b')),
        'Block 3 (check): answer must list every card id once, in order, such as "c,a,b"',
    );
    assert.match(
        SESSION_SYSTEM_PROMPT,
        /Give one check of the misi, two at most, an "activity" in place of "options"/,
    );
    assert.match(
        THEME_SYSTEM_PROMPT,
        /Screen with "activity" keeps its "type"/,
    );
});

const activityModule: PreparedModule = {
    ...demoModule,
    blocks: demoModule.blocks.map((block) =>
        block === firstCheck
            ? {
                  ...block,
                  content: {
                      ...block.content,
                      options: undefined,
                      activity: order,
                      answer: 'b,c,a',
                  },
              }
            : block,
    ),
};

test('a words-and-ideas subject refuses fraction work: no shading task and no diagram cut into parts, while maths keeps both', () => {
    const shaded = sessionDraft.parse({
        ...drawnDraft,
        blocks: drawnDraft.blocks.map((block, index) =>
            index === 2
                ? {
                      ...block,
                      content: {
                          ...block.content,
                          options: undefined,
                          activity: { type: 'shade', shape: 'bar', parts: 4 },
                          answer: '1',
                      },
                  }
                : block,
        ),
    });
    const words = checkDraft(['C1', 'C2'], [1, 3, 4], null, false)(shaded);

    assert.equal(checkDraft(['C1', 'C2'], [1, 3, 4])(shaded), null);
    assert.ok(words);
    assert.match(
        words,
        /Block 3 \(check\): a "shade" activity is fraction work/,
    );
    assert.match(words, /a diagram cut into "parts" is fraction work/);
    assert.match(
        SESSION_SYSTEM_PROMPT,
        /"Subject kind: words and ideas" means none of them/,
    );
});

test('a student does an activity: an unfinished answer is refused, a wrong one says how many are in place, and the evidence reads it in words', async (t) => {
    const app = await testApp(t);
    const demo = await demoClass(app, false, activityModule);
    const student = await demoStudent(app, demo.classId);
    const attempt = (
        await asStudent(
            app,
            student.token,
            'POST',
            `/assignments/${demo.assignmentId}/attempt`,
        )
    ).json();
    const detail = (
        await asStudent(
            app,
            student.token,
            'GET',
            `/assignments/${demo.assignmentId}`,
        )
    ).json();
    const shown = detail.blocks.find(
        (block: { content: { activity?: unknown } }) => block.content.activity,
    );
    const send = (blockId: number, tryNumber: number, answer: object) =>
        asStudent(
            app,
            student.token,
            'POST',
            `/attempts/${attempt.id}/responses`,
            { blockId, tryNumber, answer },
        );
    const activityTry = (tryNumber: number, choice: string) =>
        send(shown.id, tryNumber, {
            kind: 'check',
            choice,
            reason: 'Karena makin banyak bagian, makin kecil',
        });

    assert.deepEqual(shown.content.activity, order);
    assert.equal('answer' in shown.content, false);
    assert.equal('options' in shown.content, false);

    const unfinished = await activityTry(1, 'b,c');

    assert.equal(unfinished.statusCode, 400);
    assert.equal(unfinished.json().details[0].field, 'answer/choice');

    const wrong = await activityTry(1, 'b,a,c');

    assert.equal(wrong.statusCode, 201);
    assert.equal(wrong.json().outcome, 'not_yet');
    assert.equal(wrong.json().inPlace, 1);
    assert.equal(wrong.json().earned.hints.length, 1);

    const right = await activityTry(2, 'b,c,a');

    assert.equal(right.json().outcome, 'correct');
    assert.equal(right.json().inPlace, null);

    for (const block of detail.blocks) {
        if (block.id === shown.id) continue;
        if (block.kind === 'hook') {
            await send(block.id, 1, { kind: 'hook', choice: 'a' });
        }
        if (block.kind === 'check') {
            await send(block.id, 1, { kind: 'check', choice: 'b' });
        }
        if (block.kind === 'challenge') {
            await send(block.id, 1, {
                kind: 'challenge',
                choice: 'b',
                reason: 'Karena setengah lebih besar',
            });
        }
        if (block.kind === 'reflection') {
            await send(block.id, 1, {
                kind: 'reflection',
                understood: block.content.topics.slice(0, 1),
                confusing: [],
            });
        }
    }

    const submitted = await asStudent(
        app,
        student.token,
        'POST',
        `/attempts/${attempt.id}/submit`,
    );

    assert.equal(submitted.statusCode, 200);

    const provider = await stubProvider(t, [verdicts()]);

    await runFor(app, attempt.id, provider.config);

    const sent: {
        competencies: {
            evidence: {
                task?: string;
                options: unknown[];
                rightOption: string;
                tries: { choice: string; outcome: string }[];
            }[];
        }[];
    } = JSON.parse(provider.requests[0]?.body.messages[1]?.content ?? '{}');
    const question = sent.competencies
        .flatMap(({ evidence }) => evidence)
        .find(({ task }) => task);

    assert.ok(question, 'the evidence holds the activity');
    assert.equal(question.task, 'Mengurutkan kartu "1/2", "1/8", "1/4"');
    assert.deepEqual(question.options, []);
    assert.equal(question.rightOption, '"1/8", "1/4", "1/2"');
    assert.deepEqual(
        question.tries.map(({ choice, outcome }) => [choice, outcome]),
        [
            ['"1/8", "1/2", "1/4"', 'not_yet'],
            ['"1/8", "1/4", "1/2"', 'correct'],
        ],
    );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { completion, stubProvider } from './ai-stub.ts';
import { demoClass, demoStudent } from './demo-attempts.ts';
import { createUser, loginAs, TEST_ORIGIN, testApp } from './helpers.ts';

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

const question = {
    prompt: 'Mana yang lebih besar, 1/2 atau 1/4 pizza?',
    options: [
        { id: 'a', label: '1/2' },
        { id: 'b', label: '1/4' },
    ],
};

const names = ['Citra Dewi', 'Ayu Lestari', 'Bima Putra'];

async function challengeClass(app: FastifyInstance) {
    const demo = await demoClass(app);
    const students = [];

    for (const name of names) {
        students.push(await demoStudent(app, demo.classId, name));
    }

    const path = `/classes/${demo.classId}/challenge`;
    const [citra, ayu, bima] = students;
    const answer = (token: string, payload: object) =>
        call(app, token, 'POST', '/student/challenge/answers', payload);
    const mine = async (token: string) =>
        (await call(app, token, 'GET', '/student/challenge')).json().challenge;
    const change = (action: string, answerIds?: number[]) =>
        call(app, demo.teacherToken, 'PUT', path, { action, answerIds });

    return { ...demo, path, citra, ayu, bima, answer, mine, change };
}

test('a teacher starts one challenge at a time for their own class (FR-050)', async (t) => {
    const app = await testApp(t);
    const { teacherToken, path, mine, ayu, change } = await challengeClass(app);
    const stranger = await loginAs(app, (await createUser(app)).username);
    const start = { ...question, mode: 'solo' };

    assert.equal(
        (await call(app, teacherToken, 'GET', path)).json().challenge,
        null,
    );
    assert.equal(await mine(ayu.token), null);
    assert.equal((await call(app, stranger, 'GET', path)).statusCode, 404);
    assert.equal(
        (await call(app, stranger, 'POST', path, start)).statusCode,
        404,
    );
    assert.equal(
        (await call(app, ayu.token, 'POST', path, start)).statusCode,
        403,
    );

    const missing = await call(app, teacherToken, 'POST', path, {
        ...question,
        mode: 'group',
    });

    assert.equal(missing.statusCode, 400);
    assert.equal(missing.json().details[0].field, 'groupSize');

    const started = await call(app, teacherToken, 'POST', path, start);

    assert.equal(started.statusCode, 201);
    assert.deepEqual(
        {
            ...started.json().challenge,
            id: undefined,
            createdAt: undefined,
        },
        {
            ...question,
            id: undefined,
            createdAt: undefined,
            mode: 'solo',
            state: 'open',
            units: 3,
            answered: 0,
            groups: [],
            counts: [
                { id: 'a', count: 0 },
                { id: 'b', count: 0 },
            ],
            answers: [],
            clusters: null,
        },
    );

    const again = await call(app, teacherToken, 'POST', path, start);

    assert.equal(again.statusCode, 409);
    assert.equal(again.json().name, 'CHALLENGE_OPEN');

    assert.equal((await change('close')).json().challenge.state, 'closed');
    assert.equal(await mine(ayu.token), null);
    assert.equal((await change('reveal')).json().name, 'CHALLENGE_STATE');
    assert.equal(
        (await call(app, teacherToken, 'POST', path, start)).statusCode,
        201,
    );

    const empty = await demoClass(app);
    const none = await call(
        app,
        empty.teacherToken,
        'POST',
        `/classes/${empty.classId}/challenge`,
        start,
    );

    assert.equal(none.statusCode, 409);
    assert.equal(none.json().name, 'CLASS_EMPTY');
});

test('students answer once, see the counts after the reveal, and only the reasons the teacher shows, never a name (FR-050, FR-051, AT-13)', async (t) => {
    const app = await testApp(t);
    const { teacherToken, path, citra, ayu, bima, answer, mine, change } =
        await challengeClass(app);
    const other = await challengeClass(app);
    const { id } = (
        await call(app, teacherToken, 'POST', path, {
            ...question,
            mode: 'solo',
        })
    ).json().challenge;

    assert.deepEqual(await mine(ayu.token), {
        ...question,
        id,
        mode: 'solo',
        state: 'open',
        group: null,
        answered: null,
        result: null,
    });
    assert.equal(
        (
            await answer(other.ayu.token, {
                challengeId: id,
                choice: 'a',
                reason: 'Bukan kelasku',
            })
        ).statusCode,
        404,
    );
    assert.equal(
        (await answer(ayu.token, { challengeId: id, choice: 'c', reason: 'x' }))
            .statusCode,
        400,
    );
    assert.equal(
        (await answer(ayu.token, { challengeId: id, choice: 'a', reason: ' ' }))
            .statusCode,
        400,
    );
    assert.equal((await change('show', [])).json().name, 'CHALLENGE_STATE');

    const sent = await answer(ayu.token, {
        challengeId: id,
        choice: 'a',
        reason: 'Setengah itu dua kali seperempat',
    });

    assert.equal(sent.statusCode, 201);
    assert.deepEqual(sent.json().answered, {
        choice: 'a',
        reason: 'Setengah itu dua kali seperempat',
    });

    const twice = await answer(ayu.token, {
        challengeId: id,
        choice: 'b',
        reason: 'Ganti jawaban',
    });

    assert.equal(twice.statusCode, 409);
    assert.equal(twice.json().name, 'ALREADY_ANSWERED');

    await answer(bima.token, {
        challengeId: id,
        choice: 'b',
        reason: 'Empat lebih besar dari dua',
    });

    const waiting = await mine(ayu.token);

    assert.equal(waiting.answered.choice, 'a');
    assert.equal(waiting.result, null);

    const revealed = (await change('reveal')).json().challenge;

    assert.equal(revealed.state, 'revealed');
    assert.equal(revealed.answered, 2);
    assert.deepEqual(revealed.counts, [
        { id: 'a', count: 1 },
        { id: 'b', count: 1 },
    ]);
    assert.deepEqual(
        revealed.answers.map((entry: object) => Object.keys(entry)),
        [
            ['id', 'choice', 'reason', 'shown'],
            ['id', 'choice', 'reason', 'shown'],
        ],
    );
    assert.equal((await change('reveal')).json().name, 'CHALLENGE_STATE');

    const late = await answer(citra.token, {
        challengeId: id,
        choice: 'a',
        reason: 'Terlambat',
    });

    assert.equal(late.statusCode, 409);
    assert.equal(late.json().name, 'CHALLENGE_STATE');
    assert.deepEqual((await mine(citra.token)).result, {
        total: 2,
        counts: [
            { id: 'a', count: 1 },
            { id: 'b', count: 1 },
        ],
        reasons: [],
    });

    const shown = (
        await change('show', [revealed.answers[1].id, 999_999])
    ).json().challenge;

    assert.deepEqual(
        shown.answers.map((entry: { shown: boolean }) => entry.shown),
        [false, true],
    );

    const seen = await call(app, citra.token, 'GET', '/student/challenge');

    assert.deepEqual(seen.json().challenge.result.reasons, [
        { choice: 'b', reason: 'Empat lebih besar dari dua' },
    ]);
    for (const name of names) assert.ok(!seen.body.includes(name));

    const few = await change('cluster');

    assert.equal(few.statusCode, 409);
    assert.equal(few.json().name, 'TOO_FEW_ANSWERS');
});

test('a group shares one answer, sent by its first member (FR-050)', async (t) => {
    const app = await testApp(t);
    const { teacherToken, path, citra, ayu, bima, answer, mine } =
        await challengeClass(app);
    const { id, groups, units } = (
        await call(app, teacherToken, 'POST', path, {
            ...question,
            mode: 'group',
            groupSize: 2,
        })
    ).json().challenge;

    assert.equal(units, 2);
    assert.deepEqual(groups, [
        { id: 1, name: 'Kelompok 1', members: ['Ayu Lestari', 'Bima Putra'] },
        { id: 2, name: 'Kelompok 2', members: ['Citra Dewi'] },
    ]);
    assert.deepEqual((await mine(bima.token)).group, {
        name: 'Kelompok 1',
        members: ['Ayu Lestari', 'Bima Putra'],
    });

    const given = { choice: 'a', reason: 'Kami sepakat setengah lebih besar' };

    assert.equal(
        (await answer(ayu.token, { challengeId: id, ...given })).statusCode,
        201,
    );

    const second = await answer(bima.token, {
        challengeId: id,
        choice: 'b',
        reason: 'Aku tidak setuju',
    });

    assert.equal(second.json().name, 'ALREADY_ANSWERED');
    assert.deepEqual((await mine(bima.token)).answered, given);
    assert.equal((await mine(citra.token)).answered, null);
    assert.equal(
        (
            await answer(citra.token, {
                challengeId: id,
                choice: 'b',
                reason: 'Seperempat lebih banyak potongannya',
            })
        ).statusCode,
        201,
    );
    assert.equal(
        (await call(app, teacherToken, 'GET', path)).json().challenge.answered,
        2,
    );
});

test('the model groups the reasons without names, and a failed call changes nothing (FR-051)', async (t) => {
    const reply = (refs: number[][]) =>
        completion(
            JSON.stringify({
                groups: refs.map((list, index) => ({
                    label: `Cara pikir ${index + 1}`,
                    note: 'Tanyakan kenapa mereka berpikir begitu.',
                    refs: list,
                })),
            }),
        );
    const provider = await stubProvider(t, [
        { body: reply([[1, 9], [2]]) },
        { body: reply([[1, 3], [2]]) },
    ]);
    const app = await testApp(t, provider.config);
    const { path, teacherToken, citra, ayu, bima, answer, change } =
        await challengeClass(app);
    const { id } = (
        await call(app, teacherToken, 'POST', path, {
            ...question,
            mode: 'solo',
        })
    ).json().challenge;
    const reasons = [
        'Setengah itu dua kali seperempat',
        'Empat lebih besar dari dua',
        'Potongan setengah lebih lebar',
    ];

    for (const [index, student] of [ayu, bima, citra].entries()) {
        await answer(student.token, {
            challengeId: id,
            choice: index === 1 ? 'b' : 'a',
            reason: reasons[index],
        });
    }

    assert.equal((await change('cluster')).json().name, 'CHALLENGE_STATE');

    const { answers } = (await change('reveal')).json().challenge;
    const grouped = await change('cluster');

    assert.equal(grouped.statusCode, 200);
    assert.deepEqual(grouped.json().challenge.clusters, [
        {
            label: 'Cara pikir 1',
            note: 'Tanyakan kenapa mereka berpikir begitu.',
            answerIds: [answers[0].id, answers[2].id],
        },
        {
            label: 'Cara pikir 2',
            note: 'Tanyakan kenapa mereka berpikir begitu.',
            answerIds: [answers[1].id],
        },
    ]);
    assert.equal(provider.requests.length, 2);

    for (const { text } of provider.requests) {
        for (const hidden of [...names, 'Kelas 4A', 'Kelompok']) {
            assert.ok(!text.includes(hidden), `${hidden} went to the model`);
        }
    }

    for (const reason of reasons) {
        assert.ok(provider.requests[0].text.includes(reason));
    }

    const failed = await change('cluster');

    assert.equal(failed.statusCode, 502);
    assert.equal(failed.json().name, 'AI_FAILED');
    assert.deepEqual(
        (await call(app, teacherToken, 'GET', path)).json().challenge.clusters,
        grouped.json().challenge.clusters,
    );
});

test('the challenge screens of the class missions are offered as a start (FR-050)', async (t) => {
    const app = await testApp(t);
    const { teacherToken, path } = await challengeClass(app);
    const { sources } = (
        await call(app, teacherToken, 'GET', `${path}/sources`)
    ).json();

    assert.equal(sources.length, 1);
    assert.ok(sources[0].prompt.length > 0);
    assert.ok(sources[0].options.length >= 2);
    assert.deepEqual(Object.keys(sources[0].options[0]), ['id', 'label']);
});

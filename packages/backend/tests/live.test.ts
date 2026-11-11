import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { attempts, liveSessions } from '../src/db/schema.ts';
import { asStudent, demoClass, demoStudent } from './demo-attempts.ts';
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

async function liveClass(app: FastifyInstance) {
    const demo = await demoClass(app);
    const student = await demoStudent(app, demo.classId, 'Wulan Sari');
    const other = await demoStudent(app, demo.classId, 'Bima Putra');
    const path = `/classes/${demo.classId}/assignments/${demo.assignmentId}/live`;
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
    const blockOf = (kind: string): { id: number } =>
        detail.blocks.find((block: { kind: string }) => block.kind === kind);
    const moveTo = (kind: string) =>
        call(
            app,
            student.token,
            'PUT',
            `/student/attempts/${attempt.id}/checkpoint`,
            { blockId: blockOf(kind).id },
        );

    return { ...demo, student, other, path, attempt, blockOf, moveTo };
}

test('a teacher opens, pauses, resumes, and ends a live session of their own class, and only one runs at a time (FR-018)', async (t) => {
    const app = await testApp(t);
    const { teacherToken, path } = await liveClass(app);
    const stranger = await loginAs(app, (await createUser(app)).username);

    assert.equal(
        (await call(app, teacherToken, 'GET', path)).json().live,
        null,
    );
    assert.equal(
        (await call(app, stranger, 'POST', path, { mode: 'own_pace' }))
            .statusCode,
        404,
    );
    assert.equal(
        (await call(app, teacherToken, 'PUT', path, { action: 'pause' }))
            .statusCode,
        409,
    );

    const opened = await call(app, teacherToken, 'POST', path, {
        mode: 'own_pace',
        minutes: 30,
    });

    assert.equal(opened.statusCode, 201);
    assert.equal(opened.json().live.state, 'open');
    assert.equal(opened.json().live.openStep, 'reflection');
    assert.ok(opened.json().live.endsAt);

    const again = await call(app, teacherToken, 'POST', path, {
        mode: 'together',
    });

    assert.equal(again.statusCode, 409);
    assert.equal(again.json().name, 'LIVE_OPEN');

    const paused = await call(app, teacherToken, 'PUT', path, {
        action: 'pause',
    });
    const resumed = await call(app, teacherToken, 'PUT', path, {
        action: 'resume',
    });

    assert.equal(paused.json().live.state, 'paused');
    assert.equal(resumed.json().live.state, 'open');
    assert.ok(
        new Date(resumed.json().live.endsAt) >=
            new Date(opened.json().live.endsAt),
    );
    assert.equal(
        (
            await call(app, teacherToken, 'PUT', path, { action: 'resume' })
        ).json().name,
        'LIVE_STATE',
    );
    assert.equal(
        (await call(app, teacherToken, 'PUT', path, { action: 'advance' }))
            .statusCode,
        409,
    );

    const ended = await call(app, teacherToken, 'PUT', path, {
        action: 'end',
    });

    assert.equal(ended.json().live.state, 'ended');

    const reopened = await call(app, teacherToken, 'POST', path, {
        mode: 'together',
    });

    assert.equal(reopened.statusCode, 201);
    assert.equal(reopened.json().live.openStep, 'opening');
    assert.equal(reopened.json().live.endsAt, null);
});

test('a paused session refuses answers and moves, a session taken together holds students at the open step, and an ended one refuses nothing (FR-020)', async (t) => {
    const app = await testApp(t);
    const {
        teacherToken,
        path,
        student,
        assignmentId,
        attempt,
        blockOf,
        moveTo,
    } = await liveClass(app);
    const hook = () =>
        asStudent(
            app,
            student.token,
            'POST',
            `/attempts/${attempt.id}/responses`,
            {
                blockId: blockOf('hook').id,
                tryNumber: 1,
                answer: { kind: 'hook', choice: 'a' },
            },
        );
    const seen = () =>
        asStudent(
            app,
            student.token,
            'GET',
            `/assignments/${assignmentId}/live`,
        );

    assert.deepEqual((await seen()).json(), { live: null });

    await call(app, teacherToken, 'POST', path, { mode: 'together' });

    assert.equal((await seen()).json().live.openStep, 'opening');
    assert.equal((await moveTo('hook')).statusCode, 204);

    const early = await moveTo('story');

    assert.equal(early.statusCode, 409);
    assert.equal(early.json().name, 'LIVE_WAIT');

    await call(app, teacherToken, 'PUT', path, { action: 'pause' });

    const refused = await hook();

    assert.equal(refused.statusCode, 409);
    assert.equal(refused.json().name, 'LIVE_PAUSED');
    assert.equal((await moveTo('hook')).json().name, 'LIVE_PAUSED');

    await call(app, teacherToken, 'PUT', path, { action: 'resume' });

    assert.equal((await hook()).statusCode, 201);

    const advanced = await call(app, teacherToken, 'PUT', path, {
        action: 'advance',
    });

    assert.equal(advanced.json().live.openStep, 'story');
    assert.equal((await moveTo('story')).statusCode, 204);
    assert.equal((await moveTo('challenge')).json().name, 'LIVE_WAIT');

    await app.db
        .update(liveSessions)
        .set({ endsAt: new Date(Date.now() - 1000) })
        .where(eq(liveSessions.assignmentId, assignmentId));

    assert.equal((await seen()).json().live.state, 'ended');
    assert.equal((await moveTo('challenge')).statusCode, 204);

    await app.db
        .update(liveSessions)
        .set({ state: 'paused', pausedAt: new Date(Date.now() - 5000) })
        .where(eq(liveSessions.assignmentId, assignmentId));

    assert.equal((await seen()).json().live.state, 'paused');
    assert.equal(
        (
            await call(app, teacherToken, 'POST', path, { mode: 'own_pace' })
        ).json().name,
        'LIVE_OPEN',
    );

    const back = await call(app, teacherToken, 'PUT', path, {
        action: 'resume',
    });

    assert.equal(back.json().live.state, 'open');
    assert.ok(new Date(back.json().live.endsAt) > new Date());

    await call(app, teacherToken, 'PUT', path, { action: 'end' });
    assert.equal(
        (await call(app, teacherToken, 'POST', path, { mode: 'own_pace' }))
            .statusCode,
        201,
    );
});

test('the monitor lists students by name with a state and a step, and requests for the teacher until they are handled, without scores (FR-019)', async (t) => {
    const app = await testApp(t);
    const {
        teacherToken,
        path,
        student,
        other,
        assignmentId,
        attempt,
        blockOf,
    } = await liveClass(app);
    const monitor = async () =>
        (await call(app, teacherToken, 'GET', path)).json();

    await call(app, teacherToken, 'POST', path, { mode: 'own_pace' });

    const before = await monitor();

    assert.deepEqual(before.students, [
        { id: other.id, name: 'Bima Putra', state: 'not_started', step: null },
        {
            id: student.id,
            name: 'Wulan Sari',
            state: 'offline',
            step: 'opening',
        },
    ]);
    assert.deepEqual(before.requests, []);

    await asStudent(
        app,
        student.token,
        'GET',
        `/assignments/${assignmentId}/live`,
    );
    await call(
        app,
        student.token,
        'PUT',
        `/student/attempts/${attempt.id}/checkpoint`,
        { blockId: blockOf('check').id },
    );
    await asStudent(
        app,
        student.token,
        'POST',
        `/attempts/${attempt.id}/help`,
        {
            blockId: blockOf('check').id,
            kind: 'ask_teacher',
        },
    );

    const asked = await monitor();

    assert.deepEqual(asked.students[1], {
        id: student.id,
        name: 'Wulan Sari',
        state: 'active',
        step: 'story',
    });
    assert.equal(asked.requests.length, 1);
    assert.deepEqual(
        {
            studentId: asked.requests[0].studentId,
            name: asked.requests[0].name,
            step: asked.requests[0].step,
        },
        { studentId: student.id, name: 'Wulan Sari', step: 'story' },
    );
    assert.equal(JSON.stringify(asked).includes('outcome'), false);

    const handled = await call(
        app,
        teacherToken,
        'PUT',
        `${path}/requests/${asked.requests[0].id}`,
    );

    assert.equal(handled.statusCode, 204);
    assert.deepEqual((await monitor()).requests, []);
    assert.equal(
        (await call(app, teacherToken, 'PUT', `${path}/requests/999999999`))
            .statusCode,
        404,
    );

    await app.db
        .update(attempts)
        .set({ lastSeenAt: new Date(Date.now() - 60_000) })
        .where(eq(attempts.id, attempt.id));

    assert.equal((await monitor()).students[1].state, 'offline');
});

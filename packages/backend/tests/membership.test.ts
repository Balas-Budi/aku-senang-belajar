import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
    asStudent,
    demoClass,
    demoStudent,
    takeDemo,
} from './demo-attempts.ts';
import {
    createClass,
    createStudent,
    createUser,
    loginAs,
    TEST_ORIGIN,
    TEST_STUDENT_PASSWORD,
    testApp,
} from './helpers.ts';

function call(
    app: FastifyInstance,
    token: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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

async function joined(app: FastifyInstance, name: string, inviteCode: string) {
    const student = await createStudent(app, name);
    const token = await loginAs(app, student.username, TEST_STUDENT_PASSWORD);
    const response = await call(app, token, 'POST', '/student/class', {
        inviteCode,
    });

    assert.equal(response.statusCode, 201);

    return { ...student, token };
}

type Listed = { id: number; name: string; inactive: boolean };
type Event = {
    action: string;
    student: { name: string };
    actor: string | null;
    otherClass: string | null;
    direction: string | null;
};

const names = (students: Listed[]) => students.map(({ name }) => name);
const told = (events: Event[]) =>
    events.map(
        ({ action, student, actor, direction }) =>
            `${student.name.split(' ')[0]} ${action}${direction ? ` ${direction}` : ''} by ${actor}`,
    );

test('a teacher deactivates, reactivates, moves, and archives memberships of their own class, and every change is recorded (FR-004)', async (t) => {
    const app = await testApp(t);
    const token = await loginAs(app, (await createUser(app)).username);
    const stranger = await loginAs(app, (await createUser(app)).username);
    const first = await createClass(app, token);
    const second = await createClass(app, token);
    const foreign = await createClass(app, stranger);
    const wulan = await joined(app, 'Wulan Sari', first.inviteCode);
    const bima = await joined(app, 'Bima Putra', first.inviteCode);
    const citra = await joined(app, 'Citra Dewi', first.inviteCode);
    const roster = async (classId = first.id) =>
        (await call(app, token, 'GET', `/classes/${classId}/students`)).json();
    const change = (studentId: number, payload: object, as = token) =>
        call(
            app,
            as,
            'PUT',
            `/classes/${first.id}/students/${studentId}/membership`,
            payload,
        );

    assert.deepEqual(
        (await roster()).map(({ name, inactive }: Listed) => [name, inactive]),
        [
            ['Bima Putra', false],
            ['Citra Dewi', false],
            ['Wulan Sari', false],
        ],
    );
    assert.equal(
        (await change(wulan.id, { action: 'deactivate' }, stranger)).statusCode,
        404,
    );
    assert.equal(
        (await change(wulan.id, { action: 'deactivate' }, wulan.token))
            .statusCode,
        403,
    );

    for (const payload of [
        { action: 'move' },
        { action: 'deactivate', classId: second.id },
        { action: 'move', classId: first.id },
        { action: 'move', classId: foreign.id },
    ]) {
        const refused = await change(bima.id, payload);

        assert.equal(refused.statusCode, 400, JSON.stringify(payload));
        assert.equal(refused.json().details[0].field, 'classId');
    }

    const off = await change(wulan.id, { action: 'deactivate' });

    assert.equal(off.statusCode, 200);
    assert.deepEqual(
        off
            .json()
            .students.filter(({ inactive }: Listed) => inactive)
            .map(({ name }: Listed) => name),
        ['Wulan Sari'],
    );
    assert.equal(
        (await change(wulan.id, { action: 'deactivate' })).json().name,
        'MEMBERSHIP_STATE',
    );
    assert.equal(
        (await call(app, wulan.token, 'GET', '/student/class')).json().classroom
            .inactive,
        true,
    );
    assert.equal(
        (await change(wulan.id, { action: 'reactivate' })).statusCode,
        200,
    );
    assert.equal(
        (await change(wulan.id, { action: 'reactivate' })).json().name,
        'MEMBERSHIP_STATE',
    );
    assert.equal(
        (await call(app, wulan.token, 'GET', '/student/class')).json().classroom
            .inactive,
        false,
    );

    const moved = await change(bima.id, {
        action: 'move',
        classId: second.id,
    });

    assert.equal(moved.statusCode, 200);
    assert.deepEqual(names(moved.json().students), [
        'Citra Dewi',
        'Wulan Sari',
    ]);
    assert.deepEqual(names(await roster(second.id)), ['Bima Putra']);
    assert.equal(
        (await call(app, bima.token, 'GET', '/student/class')).json().classroom
            .id,
        second.id,
    );
    assert.equal(
        (await change(bima.id, { action: 'archive' })).statusCode,
        404,
    );

    const archived = await change(citra.id, { action: 'archive' });

    assert.equal(archived.statusCode, 200);
    assert.deepEqual(names(archived.json().students), ['Wulan Sari']);
    assert.equal(
        (await call(app, citra.token, 'GET', '/student/class')).json()
            .classroom,
        null,
    );
    assert.equal(
        (await call(app, wulan.token, 'DELETE', '/student/class')).statusCode,
        404,
    );

    const history = (
        await call(app, token, 'GET', `/classes/${first.id}/membership`)
    ).json();

    assert.deepEqual(told(history.events), [
        'Citra archived by teacher',
        'Bima moved out by teacher',
        'Wulan reactivated by teacher',
        'Wulan deactivated by teacher',
        'Citra joined by student',
        'Bima joined by student',
        'Wulan joined by student',
    ]);
    assert.equal(history.events[1].otherClass, 'Kelas 4A');
    assert.deepEqual(
        history.past.map(
            ({ name, reason, submitted }: Record<string, unknown>) => [
                name,
                reason,
                submitted,
            ],
        ),
        [
            ['Citra Dewi', 'archived', 0],
            ['Bima Putra', 'moved', 0],
        ],
    );

    const arrivals = (
        await call(app, token, 'GET', `/classes/${second.id}/membership`)
    ).json();

    assert.deepEqual(told(arrivals.events), ['Bima moved in by teacher']);
    assert.deepEqual(arrivals.past, []);
    assert.equal(
        (await call(app, stranger, 'GET', `/classes/${first.id}/membership`))
            .statusCode,
        404,
    );

    await call(app, citra.token, 'POST', '/student/class', {
        inviteCode: first.inviteCode,
    });

    const back = (
        await call(app, token, 'GET', `/classes/${first.id}/membership`)
    ).json();

    assert.equal(told(back.events)[0], 'Citra joined by student');
    assert.deepEqual(
        back.past.map(({ name }: { name: string }) => name),
        ['Bima Putra'],
    );
});

test('an inactive student cannot open or answer missions, and a departed student leaves results the teacher can still read (FR-004)', async (t) => {
    const app = await testApp(t);
    const demo = await demoClass(app);
    const wulan = await demoStudent(app, demo.classId, 'Wulan Sari');
    const bima = await demoStudent(app, demo.classId, 'Bima Putra');
    const change = (studentId: number, action: string) =>
        call(
            app,
            demo.teacherToken,
            'PUT',
            `/classes/${demo.classId}/students/${studentId}/membership`,
            { action },
        );
    const mission = `/assignments/${demo.assignmentId}`;

    await takeDemo(app, wulan.token, demo.assignmentId);

    const attempt = (
        await asStudent(app, bima.token, 'POST', `${mission}/attempt`)
    ).json();
    const detail = (await asStudent(app, bima.token, 'GET', mission)).json();
    const hook = detail.blocks.find(
        ({ kind }: { kind: string }) => kind === 'hook',
    );
    const answer = () =>
        asStudent(
            app,
            bima.token,
            'POST',
            `/attempts/${attempt.id}/responses`,
            {
                blockId: hook.id,
                tryNumber: 1,
                answer: { kind: 'hook', choice: 'a' },
            },
        );

    await change(bima.id, 'deactivate');

    const closed = await asStudent(app, bima.token, 'GET', mission);

    assert.equal(closed.statusCode, 403);
    assert.equal(closed.json().name, 'MEMBERSHIP_INACTIVE');
    assert.equal(
        (await asStudent(app, bima.token, 'POST', `${mission}/attempt`))
            .statusCode,
        403,
    );
    assert.equal((await answer()).statusCode, 404);

    await change(bima.id, 'reactivate');
    assert.equal(
        (await asStudent(app, bima.token, 'GET', mission)).statusCode,
        200,
    );
    assert.equal((await answer()).statusCode, 201);

    const report = `/classes/${demo.classId}/students/${wulan.id}/report`;
    const before = await call(app, demo.teacherToken, 'GET', report);

    assert.equal(before.statusCode, 200);
    assert.equal(before.json().member, true);

    await change(wulan.id, 'archive');

    const after = await call(app, demo.teacherToken, 'GET', report);

    assert.equal(after.statusCode, 200);
    assert.equal(after.json().member, false);
    assert.equal(after.json().missions.length, 1);
    assert.equal(after.json().student.name, 'Wulan Sari');
    assert.equal(
        (await call(app, demo.teacherToken, 'POST', `${report}/draft`))
            .statusCode,
        404,
    );
    assert.equal(
        (
            await call(
                app,
                demo.teacherToken,
                'PUT',
                `/classes/${demo.classId}/students/${wulan.id}/adaptations/mathematics`,
                { off: true },
            )
        ).statusCode,
        404,
    );

    const { past } = (
        await call(
            app,
            demo.teacherToken,
            'GET',
            `/classes/${demo.classId}/membership`,
        )
    ).json();

    assert.deepEqual(
        past.map(({ name, reason, submitted }: Record<string, unknown>) => [
            name,
            reason,
            submitted,
        ]),
        [['Wulan Sari', 'archived', 1]],
    );

    const outsider = await createStudent(app, 'Orang Lain');

    assert.equal(
        (
            await call(
                app,
                demo.teacherToken,
                'GET',
                `/classes/${demo.classId}/students/${outsider.id}/report`,
            )
        ).statusCode,
        404,
    );
});

test("an admin's move is recorded as joined, moved, or archived by the admin (FR-004)", async (t) => {
    const app = await testApp(t);
    const token = await loginAs(app, (await createUser(app)).username);
    const admin = await loginAs(app, (await createUser(app, 'admin')).username);
    const first = await createClass(app, token);
    const second = await createClass(app, token);
    const student = await createStudent(app, 'Dimas Pratama');
    const place = (classId: number | null) =>
        call(app, admin, 'PUT', `/admin/students/${student.id}/class`, {
            classId,
        });

    assert.equal((await place(first.id)).statusCode, 200);
    assert.equal((await place(first.id)).statusCode, 200);
    assert.equal((await place(second.id)).json().classroom.id, second.id);
    assert.equal((await place(null)).json().classroom, null);
    assert.equal((await place(null)).statusCode, 200);

    const from = (
        await call(app, token, 'GET', `/classes/${first.id}/membership`)
    ).json();
    const to = (
        await call(app, token, 'GET', `/classes/${second.id}/membership`)
    ).json();

    assert.deepEqual(told(from.events), [
        'Dimas moved out by admin',
        'Dimas joined by admin',
    ]);
    assert.deepEqual(told(to.events), [
        'Dimas archived by admin',
        'Dimas moved in by admin',
    ]);
    assert.deepEqual(
        to.past.map(({ reason }: { reason: string }) => reason),
        ['archived'],
    );
});

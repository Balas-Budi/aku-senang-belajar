import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { attempts, learningSessions } from '../src/db/schema.ts';
import { completion, stubProvider } from './ai-stub.ts';
import { asStudent, demoClass, demoStudent } from './demo-attempts.ts';
import { createUser, loginAs, TEST_ORIGIN, testApp } from './helpers.ts';
import {
    draft,
    draftedSession,
    post,
    put,
    type Session,
    settled,
    teacherWithModule,
} from './studio-fixtures.ts';

function remove(app: FastifyInstance, token: string, url: string) {
    return app.inject({
        method: 'DELETE',
        url,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
    });
}

const kinds = (session: Session) => session.blocks.map(({ kind }) => kind);
const positions = (session: Session) =>
    (session.blocks as { position?: number }[]).map(({ position }) => position);

const story = draft.blocks.find(({ kind }) => kind === 'story');

assert.ok(story);

const longer = (stories: number) => {
    const extra = Array.from({ length: stories - 2 }, () => story);

    return {
        ...draft,
        blocks: [draft.blocks[0], ...extra, ...draft.blocks.slice(1)],
    };
};

test('a teacher adds, moves, and removes screens of a draft inside the structure of a misi (FR-012)', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
        { body: completion(JSON.stringify(draft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    const other = await draftedSession(app, token, moduleId);
    const stranger = await loginAs(app, (await createUser(app)).username);
    const base = `/api/studio/sessions/${session.id}`;
    const idOf = (now: Session, index: number) => now.blocks[index].id;

    assert.deepEqual(kinds(session), [
        'brain_game',
        'hook',
        'story',
        'check',
        'story',
        'check',
        'challenge',
        'reflection',
        'extra_challenge',
    ]);

    const add = (after: number, text: string, as = token) =>
        post(app, as, `${base}/blocks`, { after, content: { text } });
    const hook = idOf(session, 1);

    assert.equal(
        (await add(hook, 'Kancil membawa roti.', stranger)).statusCode,
        404,
    );
    assert.equal(
        (await add(idOf(other, 2), 'Kancil membawa roti.')).statusCode,
        404,
    );

    const long = await add(hook, 'Satu. Dua. Tiga.');

    assert.equal(long.statusCode, 400);
    assert.equal(long.json().details[0].field, 'content/text');

    const late = await add(idOf(session, 6), 'Kancil membawa roti.');

    assert.equal(late.statusCode, 409);
    assert.equal(late.json().name, 'KEEP_STRUCTURE');

    const added = await add(hook, 'Kancil membawa roti untuk teman-temannya.');

    assert.equal(added.statusCode, 201);

    let now: Session = added.json();

    assert.equal(now.version, session.version + 1);
    assert.deepEqual(kinds(now).slice(1, 4), ['hook', 'story', 'story']);
    assert.deepEqual(now.blocks[2].content, {
        text: 'Kancil membawa roti untuk teman-temannya.',
    });
    assert.deepEqual(now.blocks[2].competencies, []);
    assert.deepEqual(now.blocks[2].sourcePages, []);
    assert.deepEqual(positions(now), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const move = (blockId: number, direction: string) =>
        put(app, token, `${base}/blocks/${blockId}/position`, {
            move: direction,
        });
    const newStory = idOf(now, 2);

    assert.equal((await move(newStory, 'up')).json().name, 'KEEP_STRUCTURE');
    assert.equal(
        (await move(idOf(now, 6), 'down')).json().name,
        'KEEP_STRUCTURE',
    );
    assert.equal(
        (await move(idOf(now, 7), 'up')).json().name,
        'KEEP_STRUCTURE',
    );

    const moved = await move(newStory, 'down');

    assert.equal(moved.statusCode, 200);
    now = moved.json();
    assert.equal(idOf(now, 3), newStory);
    assert.deepEqual(positions(now), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(now.version, session.version + 2);

    const drop = (blockId: number) =>
        remove(app, token, `${base}/blocks/${blockId}`);

    assert.equal((await drop(idOf(now, 0))).json().name, 'KEEP_STRUCTURE');
    assert.equal((await drop(idOf(now, 7))).json().name, 'KEEP_STRUCTURE');

    const c1Check = now.blocks.find(
        ({ kind, competencies }) =>
            kind === 'check' && competencies.includes('C1'),
    );

    assert.ok(c1Check);

    const untested = await drop(c1Check.id);

    assert.equal(untested.statusCode, 409);
    assert.equal(untested.json().name, 'COMPETENCY_UNTESTED');
    assert.match(untested.json().message, /C1/);

    const dropped = await drop(newStory);

    assert.equal(dropped.statusCode, 200);
    now = dropped.json();
    assert.ok(!now.blocks.some(({ id }) => id === newStory));
    assert.deepEqual(positions(now), [1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const firstStory = now.blocks.find(({ kind }) => kind === 'story');

    assert.ok(firstStory);
    assert.equal((await drop(firstStory.id)).json().name, 'KEEP_STRUCTURE');

    const c2Check = now.blocks.find(
        ({ kind, competencies }) =>
            kind === 'check' && competencies.includes('C2'),
    );

    assert.ok(c2Check);

    const second = await drop(c2Check.id);

    assert.equal(second.statusCode, 200);
    assert.deepEqual(kinds(second.json()), [
        'brain_game',
        'hook',
        'story',
        'check',
        'story',
        'challenge',
        'reflection',
        'extra_challenge',
    ]);
    assert.equal(
        (await remove(app, stranger, `${base}/blocks/${idOf(now, 2)}`))
            .statusCode,
        404,
    );
});

test('the length chosen at drafting sets how many story screens the model must write, in the draft and every revision (FR-012)', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
        { body: completion(JSON.stringify(longer(4))) },
        { body: completion(JSON.stringify(longer(5))) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const created = await post(
        app,
        token,
        `/api/modules/${moduleId}/sessions`,
        {
            length: 'short',
        },
    );
    const session = await settled(app, token, created.json().id);

    assert.equal(session.drafting, null);
    assert.equal((session as Session & { length: string }).length, 'short');
    assert.equal(kinds(session).filter((kind) => kind === 'story').length, 4);
    assert.match(
        provider.requests[0].body.messages[1].content,
        /Length: the teacher asked for a short misi, so write four to five "story" screens/,
    );
    assert.match(
        provider.requests[1].text,
        /write 4 to 5 \\"story\\" screens, not 2/,
    );

    await post(app, token, `/api/studio/sessions/${session.id}/revisions`, {
        note: 'Buat lebih mudah.',
    });

    const revised = await settled(app, token, session.id);

    assert.equal(kinds(revised).filter((kind) => kind === 'story').length, 5);
    assert.match(
        provider.requests[2].body.messages[1].content,
        /Length: the teacher asked for a short misi/,
    );
    assert.equal(
        (
            await post(app, token, `/api/modules/${moduleId}/sessions`, {
                length: 'huge',
            })
        ).statusCode,
        400,
    );
});

test('a misi marked to be read aloud reads for students who never chose themselves (FR-012)', async (t) => {
    const app = await testApp(t);
    const demo = await demoClass(app);
    const marked = await app.db
        .select({ readAloud: learningSessions.readAloud })
        .from(learningSessions)
        .where(eq(learningSessions.id, demo.sessionId));

    assert.equal(marked[0].readAloud, false);
    assert.equal(
        (
            await put(
                app,
                demo.teacherToken,
                `/api/studio/sessions/${demo.sessionId}/read-aloud`,
                { readAloud: true },
            )
        ).statusCode,
        404,
    );

    await app.db
        .update(learningSessions)
        .set({ readAloud: true })
        .where(eq(learningSessions.id, demo.sessionId));

    const fresh = await demoStudent(app, demo.classId, 'Wulan Sari');
    const chooser = await demoStudent(app, demo.classId, 'Bima Putra');

    await app.inject({
        method: 'PUT',
        url: '/api/student/settings',
        headers: { origin: TEST_ORIGIN },
        cookies: { session: chooser.token },
        payload: {
            textSize: 'normal',
            readAloud: false,
            speechRate: 1,
            readAloudChosen: true,
        },
    });

    const detail = await asStudent(
        app,
        fresh.token,
        'GET',
        `/assignments/${demo.assignmentId}`,
    );

    assert.equal(detail.json().readAloud, true);

    const readAloudOf = async (studentToken: string) => {
        const started = await asStudent(
            app,
            studentToken,
            'POST',
            `/assignments/${demo.assignmentId}/attempt`,
        );
        const [row] = await app.db
            .select({ readAloud: attempts.readAloud })
            .from(attempts)
            .where(eq(attempts.id, started.json().id));

        return row.readAloud;
    };

    assert.equal(await readAloudOf(fresh.token), true);
    assert.equal(await readAloudOf(chooser.token), false);
});

test('a teacher marks their own draft or published misi to be read aloud without changing its version', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);
    const url = `/api/studio/sessions/${session.id}/read-aloud`;
    const stranger = await loginAs(app, (await createUser(app)).username);

    assert.equal(
        (await put(app, stranger, url, { readAloud: true })).statusCode,
        404,
    );
    assert.equal(
        (session as Session & { readAloud: boolean }).readAloud,
        false,
    );

    const marked = await put(app, token, url, { readAloud: true });

    assert.equal(marked.statusCode, 200);
    assert.equal(marked.json().readAloud, true);
    assert.equal(marked.json().version, session.version);

    await app.db
        .update(learningSessions)
        .set({ status: 'ready' })
        .where(eq(learningSessions.id, session.id));

    const published = await put(app, token, url, { readAloud: false });

    assert.equal(published.statusCode, 200);
    assert.equal(published.json().readAloud, false);
    assert.equal(
        (
            await post(
                app,
                token,
                `/api/studio/sessions/${session.id}/blocks`,
                {
                    after: session.blocks[1].id,
                    content: { text: 'Kancil membawa roti.' },
                },
            )
        ).json().name,
        'SESSION_PUBLISHED',
    );
});

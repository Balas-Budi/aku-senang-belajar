import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    assignments,
    attempts,
    learningSessions,
    sessionBlocks,
    sessionBlockThemes,
    sessionThemes,
    users,
    type Interest,
} from '../src/db/schema.ts';
import {
    interestNames,
    THEME_SYSTEM_PROMPT,
} from '../src/studio/theme-draft.ts';
import {
    completion,
    stubProvider,
    type ProviderRequest,
    type Reply,
} from './ai-stub.ts';
import { backgroundSettled } from '../src/lib/background.ts';
import { claimSummary, processSummary } from '../src/memory/summaries.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    drawnDemoModule,
    drawnLabel,
    refsOf,
    runFor,
    seedTheme,
    takeDemo,
    verdicts,
    withInterests,
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
import {
    draft,
    draftedSession,
    drawnDraft,
    fractionDraft,
    get,
    post,
    put,
    quarters,
    settled,
    teacherWithModule,
    themedDraft,
    themeReply,
    themesSettled,
    type Session,
} from './studio-fixtures.ts';

type Content = Record<string, unknown>;
type Screen = { screen: number; content: Content };
type ThemeState = Session['themes'][number] & {
    mismatch: boolean;
    complete: boolean;
};
type Studio = Omit<Session, 'themes'> & {
    themes: ThemeState[];
    interests: { key: string; students: number }[];
    issues: { code: string; themes?: string[] }[];
};

const themesUrl = (id: number) => `/api/studio/sessions/${id}/themes`;
const themeUrl = (id: number, theme: string) =>
    `/api/studio/sessions/${id}/themes/${theme}`;
const approval = (id: number) => `/api/studio/sessions/${id}/approval`;

function themed(theme: Interest, from: object = draft) {
    return structuredClone(
        themedDraft(interestNames[theme], from as typeof draft),
    ) as { blocks: Screen[] };
}

function screenOf(reply: { blocks: Screen[] }, screen: number) {
    const found = reply.blocks.find((block) => block.screen === screen);
    assert.ok(found, `screen ${screen} is in the reply`);
    return found.content;
}

const isTheme = (request: ProviderRequest) =>
    request.body.messages[0]?.content === THEME_SYSTEM_PROMPT;

const asksFor = (request: ProviderRequest, theme: Interest) =>
    request.body.messages.some(
        ({ role, content }) =>
            role === 'user' &&
            content.includes(`Theme: ${interestNames[theme]}\n`),
    );

function replies(
    byTheme: Partial<Record<Interest, object | object[]>>,
    from: object = draft,
    slow: Interest[] = [],
): Reply[] {
    const answer = themeReply(byTheme);

    return Array.from({ length: 60 }, () => (request: ProviderRequest) => {
        if (!isTheme(request)) {
            return { body: completion(JSON.stringify(from)) };
        }

        const reply = typeof answer === 'function' ? answer(request) : answer;

        return slow.some((theme) => asksFor(request, theme))
            ? { ...reply, delay: 300 }
            : reply;
    });
}

async function themingApp(
    t: TestContext,
    byTheme: Partial<Record<Interest, object | object[]>>,
    from: object = draft,
    slow: Interest[] = [],
) {
    const provider = await stubProvider(t, replies(byTheme, from, slow));
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);

    return { app, provider, token, moduleId, session };
}

async function studio(app: FastifyInstance, token: string, id: number) {
    const session: Studio = (
        await get(app, token, `/api/studio/sessions/${id}`)
    ).json();
    return session;
}

async function readBody(app: FastifyInstance, token: string, id: number) {
    return { read: true, version: (await studio(app, token, id)).version };
}

async function chosen(
    app: FastifyInstance,
    token: string,
    id: number,
    themes: Interest[],
) {
    const response = await post(app, token, themesUrl(id), { themes });
    assert.equal(response.statusCode, 202, response.body);
    await themesSettled(app, token, id);
    return studio(app, token, id);
}

function remove(app: FastifyInstance, token: string, url: string) {
    return app.inject({
        method: 'DELETE',
        url,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
    });
}

async function setDrafting(
    app: FastifyInstance,
    sessionId: number,
    theme: Interest,
    drafting: 'generating' | 'failed' | null,
) {
    await app.db
        .update(sessionThemes)
        .set({ drafting, draftError: drafting === 'failed' ? 'http' : null })
        .where(
            and(
                eq(sessionThemes.learningSessionId, sessionId),
                eq(sessionThemes.theme, theme),
            ),
        );
}

async function themeBlockRows(
    app: FastifyInstance,
    sessionId: number,
    theme: Interest,
) {
    return app.db
        .select({ id: sessionBlockThemes.id })
        .from(sessionBlockThemes)
        .innerJoin(
            sessionBlocks,
            eq(sessionBlocks.id, sessionBlockThemes.blockId),
        )
        .where(
            and(
                eq(sessionBlocks.learningSessionId, sessionId),
                eq(sessionBlockThemes.theme, theme),
            ),
        );
}

function issueOf(session: Studio, code: string) {
    return session.issues.find((issue) => issue.code === code);
}

test('choosing themes drafts one theme per interest from the base screens, and the studio shows them with anonymous interest counts', async (t) => {
    const { app, provider, token, session } = await themingApp(
        t,
        {
            football: themed('football', drawnDraft),
            music: themed('music', drawnDraft),
        },
        drawnDraft,
    );
    const first = await createClass(app, token);
    const second = await createClass(app, token);
    const ayu = await demoStudent(app, first.id, 'Ayu Lestari');
    const bima = await demoStudent(app, second.id, 'Bima Putra');
    const gone = await demoStudent(app, first.id, 'Citra Dewi');
    await withInterests(app, ayu.id, ['football', 'music']);
    await withInterests(app, bima.id, ['football']);
    await withInterests(app, gone.id, ['football', 'space']);
    await app.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, gone.id));
    const other = await createUser(app);
    const otherClass = await createClass(
        app,
        await loginAs(app, other.username),
    );
    const outsider = await demoStudent(app, otherClass.id, 'Dewi Ayu');
    await withInterests(app, outsider.id, ['football', 'cooking']);

    const response = await post(app, token, themesUrl(session.id), {
        themes: ['music', 'football'],
    });
    assert.equal(response.statusCode, 202);
    assert.deepEqual(response.json(), { themes: ['music', 'football'] });
    await themesSettled(app, token, session.id);
    const opened = await studio(app, token, session.id);

    const [owner] = await app.db
        .select({ username: users.username })
        .from(users)
        .innerJoin(learningSessions, eq(learningSessions.createdBy, users.id))
        .where(eq(learningSessions.id, session.id));
    const asked = provider.requests.filter(isTheme);
    assert.equal(asked.length, 2);
    for (const theme of ['football', 'music'] as const) {
        const request = asked.find((entry) => asksFor(entry, theme));
        assert.ok(request, `a request for ${theme}`);
        const user = request.body.messages[1]?.content ?? '';
        assert.match(user, /<misi>\n\{"screen":2,"kind":"hook"/);
        assert.doesNotMatch(user, /"diagram"/);
        assert.ok(user.includes(`next to the screen text: ${quarters.label}`));
        assert.match(user, /next to "hints\.1": Roti dibagi/);
        assert.doesNotMatch(user, /"picture"/);
        assert.ok(!user.includes(owner.username));
        assert.ok(!user.includes('Kelas 4A'));
    }

    const base = opened.blocks.filter(({ kind }) => kind !== 'brain_game');
    assert.deepEqual(
        opened.themes.map(({ theme, drafting, read, mismatch, complete }) => ({
            theme,
            drafting,
            read,
            mismatch,
            complete,
        })),
        [
            {
                theme: 'football',
                drafting: null,
                read: false,
                mismatch: false,
                complete: true,
            },
            {
                theme: 'music',
                drafting: null,
                read: false,
                mismatch: false,
                complete: true,
            },
        ],
    );
    for (const { theme, blocks } of opened.themes) {
        assert.deepEqual(
            blocks.map(({ id }) => id),
            base.map(({ id }) => id),
        );
        const label = interestNames[theme as Interest];
        assert.ok(
            blocks.every(({ content }) => {
                const text = JSON.stringify(content);
                return (
                    text.includes(`Tema ${label}:`) && !/"diagram"/.test(text)
                );
            }),
        );
    }
    assert.ok(opened.version > session.version);
    assert.deepEqual(opened.interests, [
        { key: 'animals', students: 0 },
        { key: 'football', students: 2 },
        { key: 'superheroes', students: 0 },
        { key: 'space', students: 0 },
        { key: 'music', students: 1 },
        { key: 'drawing', students: 0 },
        { key: 'cooking', students: 0 },
        { key: 'nature', students: 0 },
    ]);
});

test('choosing themes refuses bad lists, other callers, and sessions that cannot take themes', async (t) => {
    const { app, token, moduleId, session } = await themingApp(t, {
        football: themed('football'),
        music: themed('music'),
    });
    const choose = (themes: unknown, id = session.id, as = token) =>
        post(app, as, themesUrl(id), { themes });
    const invalid = async (themes: unknown, message?: string) => {
        const response = await choose(themes);
        assert.equal(response.statusCode, 400, JSON.stringify(themes));
        assert.equal(response.json().name, 'VALIDATION_ERROR');
        assert.match(response.json().details[0].field, /^themes/);
        if (message) assert.equal(response.json().details[0].message, message);
    };

    await invalid(['robots']);
    await invalid([]);
    await invalid(['football', 'music', 'space', 'cooking']);
    await invalid(['football', 'football']);
    await chosen(app, token, session.id, ['football']);
    await invalid(['football'], 'Already chosen');
    await invalid(['music', 'space', 'cooking'], 'At most three themes');

    const other = await createUser(app);
    const foreign = await choose(
        ['music'],
        session.id,
        await loginAs(app, other.username),
    );
    assert.equal(foreign.statusCode, 404);
    assert.equal(foreign.json().name, 'NOT_FOUND');
    const student = await createStudent(app);
    const asStudentToken = await loginAs(
        app,
        student.username,
        TEST_STUDENT_PASSWORD,
    );
    assert.equal(
        (await choose(['music'], session.id, asStudentToken)).statusCode,
        403,
    );

    await app.db
        .update(learningSessions)
        .set({ drafting: 'generating' })
        .where(eq(learningSessions.id, session.id));
    const drafting = await choose(['music']);
    assert.equal(drafting.statusCode, 409);
    assert.equal(drafting.json().name, 'SESSION_DRAFTING');
    await app.db
        .update(learningSessions)
        .set({ drafting: null })
        .where(eq(learningSessions.id, session.id));

    const plain = await testApp(t);
    const offline = await post(plain, token, themesUrl(session.id), {
        themes: ['music'],
    });
    assert.equal(offline.statusCode, 503);
    assert.equal(offline.json().name, 'AI_NOT_CONFIGURED');

    const empty = await draftedSession(app, token, moduleId);
    await app.db
        .delete(sessionBlocks)
        .where(eq(sessionBlocks.learningSessionId, empty.id));
    const undrafted = await choose(['music'], empty.id);
    assert.equal(undrafted.statusCode, 409);
    assert.equal(undrafted.json().name, 'SESSION_NOT_DRAFTED');

    const ready = await draftedSession(app, token, moduleId);
    const approved = await post(app, token, approval(ready.id), {
        acknowledged: ['unreadable_pages'],
        version: ready.version,
    });
    assert.equal(approved.statusCode, 200);
    const published = await choose(['music'], ready.id);
    assert.equal(published.statusCode, 409);
    assert.equal(published.json().name, 'SESSION_PUBLISHED');
});

test('a theme reply that breaks the base three times fails without stored screens, naming the screen to repair', async (t) => {
    const changedId = themed('animals', fractionDraft);
    const options = screenOf(changedId, 4).options as { id: string }[];
    options[0].id = 'z';
    const changedAnswer = themed('football', fractionDraft);
    screenOf(changedAnswer, 4).answer = 'b';
    const changedDigit = themed('superheroes', fractionDraft);
    const labels = screenOf(changedDigit, 7).options as { label: string }[];
    labels[0].label = labels[0].label.replace('1/4', '1/3');
    const changedFraction = themed('space', fractionDraft);
    const fraction = screenOf(changedFraction, 3).fraction as {
        numerator: number;
    };
    fraction.numerator = 2;
    const drawn = themed('music', fractionDraft);
    screenOf(drawn, 3).diagram = quarters;
    const missing = themed('drawing', fractionDraft);
    missing.blocks = missing.blocks.filter(({ screen }) => screen !== 5);
    const cases = [
        ['animals', changedId, /Screen 4 \(check\)/],
        ['football', changedAnswer, /Screen 4 \(check\)/],
        ['superheroes', changedDigit, /Screen 7 \(challenge\)/],
        ['space', changedFraction, /Screen 3 \(story\)/],
        ['music', drawn, /Screen 3 \(story\)/],
        ['drawing', missing, /screen 5 is missing/],
    ] as const;
    const { app, provider, token, moduleId } = await themingApp(
        t,
        {
            ...Object.fromEntries(
                cases.map(([theme, reply]) => [theme, reply]),
            ),
            cooking: [changedAnswer, themed('cooking', fractionDraft)],
        },
        fractionDraft,
    );
    const first = await draftedSession(app, token, moduleId);
    const second = await draftedSession(app, token, moduleId);
    await chosen(app, token, first.id, ['animals', 'football', 'superheroes']);
    await chosen(app, token, second.id, ['space', 'music', 'drawing']);

    for (const [theme, , named] of cases) {
        const sessionId = ['animals', 'football', 'superheroes'].includes(theme)
            ? first.id
            : second.id;
        const row = (await studio(app, token, sessionId)).themes.find(
            (entry) => entry.theme === theme,
        );
        assert.equal(row?.drafting, 'failed', theme);
        assert.equal(row?.draftError, 'invalid_output', theme);
        assert.deepEqual(row?.blocks, []);
        assert.deepEqual(await themeBlockRows(app, sessionId, theme), []);
        const asked = provider.requests.filter((request) =>
            asksFor(request, theme),
        );
        assert.equal(asked.length, 3, theme);
        assert.match(asked[1].body.messages.at(-1)?.content ?? '', named);
    }

    const third = await draftedSession(app, token, moduleId);
    const repaired = await chosen(app, token, third.id, ['cooking']);
    assert.equal(repaired.themes[0].drafting, null);
    assert.equal(repaired.themes[0].complete, true);
    assert.equal(
        provider.requests.filter((request) => asksFor(request, 'cooking'))
            .length,
        2,
    );
});

test('a theme screen edit keeps the base answers and numbers and clears the read mark; reading needs a complete idle theme', async (t) => {
    const { app, token, session } = await themingApp(t, {
        football: themed('football'),
    });
    const opened = await chosen(app, token, session.id, ['football']);
    const url = themeUrl(session.id, 'football');
    const atPosition = (position: number) => {
        const block = opened.blocks[position - 1];
        assert.ok(block);
        const themedBlock = opened.themes[0].blocks.find(
            ({ id }) => id === block.id,
        );
        assert.ok(themedBlock);
        return { id: block.id, content: structuredClone(themedBlock.content) };
    };

    const read = await put(
        app,
        token,
        url,
        await readBody(app, token, session.id),
    );
    assert.equal(read.statusCode, 200);
    assert.deepEqual(read.json(), { theme: 'football', read: true });
    assert.equal((await studio(app, token, session.id)).themes[0].read, true);

    const hook = atPosition(2);
    hook.content.prompt = 'Pernahkah kamu bermain bola bersama teman?';
    const edited = await put(app, token, url, {
        blockId: hook.id,
        content: hook.content,
    });
    assert.equal(edited.statusCode, 200);
    assert.deepEqual(edited.json(), {
        theme: 'football',
        blockId: hook.id,
        read: false,
    });
    const after = await studio(app, token, session.id);
    assert.equal(after.themes[0].read, false);
    assert.equal(
        after.themes[0].blocks.find(({ id }) => id === hook.id)?.content.prompt,
        'Pernahkah kamu bermain bola bersama teman?',
    );
    assert.equal(after.version, opened.version + 1);
    const stale = await put(app, token, url, {
        read: true,
        version: opened.version,
    });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().name, 'SESSION_CHANGED');
    assert.equal((await studio(app, token, session.id)).themes[0].read, false);

    const refused = async (
        blockId: number,
        content: Content,
        field: string,
        message: RegExp,
    ) => {
        const response = await put(app, token, url, { blockId, content });
        assert.equal(response.statusCode, 400, response.body);
        assert.equal(response.json().name, 'VALIDATION_ERROR');
        assert.equal(response.json().details[0].field, field);
        assert.match(response.json().details[0].message, message);
    };
    const check = atPosition(4);
    await refused(
        check.id,
        { ...check.content, answer: 'b' },
        'content',
        /^Theme rule: Keep the answer a/,
    );
    const challenge = atPosition(7);
    const options = challenge.content.options as { label: string }[];
    await refused(
        challenge.id,
        {
            ...challenge.content,
            options: [options[0], { ...options[1], label: 'Tema: 1/3' }],
        },
        'content',
        /^Theme rule: /,
    );
    const story = atPosition(3);
    await refused(
        story.id,
        { ...story.content, diagram: quarters },
        'content/diagram',
        /^Pictures come from the base mission$/,
    );
    await refused(
        story.id,
        {
            ...story.content,
            text: 'Kancil punya satu bola. Ia bermain dengan tiga temannya. Mereka senang.',
        },
        'content/text',
        /./,
    );

    await setDrafting(app, session.id, 'football', 'generating');
    for (const body of [
        { blockId: hook.id, content: hook.content },
        await readBody(app, token, session.id),
    ]) {
        const response = await put(app, token, url, body);
        assert.equal(response.statusCode, 409);
        assert.equal(response.json().name, 'THEME_DRAFTING');
    }

    await setDrafting(app, session.id, 'football', 'failed');
    const failed = await put(
        app,
        token,
        url,
        await readBody(app, token, session.id),
    );
    assert.equal(failed.statusCode, 409);
    assert.equal(failed.json().name, 'THEME_NOT_READY');

    await setDrafting(app, session.id, 'football', null);
    await app.db
        .delete(sessionBlockThemes)
        .where(
            and(
                eq(sessionBlockThemes.blockId, story.id),
                eq(sessionBlockThemes.theme, 'football'),
            ),
        );
    const incomplete = await put(
        app,
        token,
        url,
        await readBody(app, token, session.id),
    );
    assert.equal(incomplete.statusCode, 409);
    assert.equal(incomplete.json().name, 'THEME_NOT_READY');

    const unknown = await put(
        app,
        token,
        themeUrl(session.id, 'music'),
        await readBody(app, token, session.id),
    );
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().message, 'Theme not found');
});

test('a redraft sends the note and the current theme; removing a theme deletes its screens, even mid-draft', async (t) => {
    const { app, provider, token, session } = await themingApp(
        t,
        { football: themed('football'), space: themed('space') },
        draft,
        ['space'],
    );
    await chosen(app, token, session.id, ['football']);
    await put(
        app,
        token,
        themeUrl(session.id, 'football'),
        await readBody(app, token, session.id),
    );

    const redraft = await post(
        app,
        token,
        `${themeUrl(session.id, 'football')}/draft`,
        { note: 'Pakai lapangan sekolah.' },
    );
    assert.equal(redraft.statusCode, 202);
    assert.deepEqual(redraft.json(), { theme: 'football' });
    const redrafted = await themesSettled(app, token, session.id);
    assert.equal(redrafted.themes[0].read, false);
    const request = provider.requests
        .filter((entry) => asksFor(entry, 'football'))
        .at(-1);
    const user = request?.body.messages[1]?.content ?? '';
    assert.match(user, /Current theme:\n<tema>\n\{"screen":2/);
    assert.match(
        user,
        /The teacher asks for this change: Pakai lapangan sekolah\.$/,
    );

    await setDrafting(app, session.id, 'football', 'generating');
    const busy = await post(
        app,
        token,
        `${themeUrl(session.id, 'football')}/draft`,
        {},
    );
    assert.equal(busy.statusCode, 409);
    assert.equal(busy.json().name, 'THEME_DRAFTING');
    await setDrafting(app, session.id, 'football', null);

    const removed = await remove(app, token, themeUrl(session.id, 'football'));
    assert.equal(removed.statusCode, 204);
    assert.deepEqual(await themeBlockRows(app, session.id, 'football'), []);
    assert.deepEqual((await studio(app, token, session.id)).themes, []);

    const unknown = await remove(app, token, themeUrl(session.id, 'music'));
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().message, 'Theme not found');
    assert.equal(
        (await remove(app, token, themeUrl(session.id, 'robots'))).statusCode,
        400,
    );

    const before = (await studio(app, token, session.id)).version;
    const started = await post(app, token, themesUrl(session.id), {
        themes: ['space'],
    });
    assert.equal(started.statusCode, 202);
    const askedForSpace = () =>
        provider.requests.filter((request) => asksFor(request, 'space')).length;
    for (let tries = 0; tries < 200 && askedForSpace() === 0; tries++)
        await new Promise((done) => setTimeout(done, 10));
    assert.equal(askedForSpace(), 1);
    const midDraft = await remove(app, token, themeUrl(session.id, 'space'));
    assert.equal(midDraft.statusCode, 204);
    await backgroundSettled(app);
    assert.equal(askedForSpace(), 1);
    assert.deepEqual(await themeBlockRows(app, session.id, 'space'), []);
    const left = await studio(app, token, session.id);
    assert.deepEqual(left.themes, []);
    assert.equal(left.version, before + 2);
});

test('a base revision waits for theme drafts and then removes every theme; a base edit raises the version and unmarks the theme', async (t) => {
    const { app, token, session } = await themingApp(t, {
        football: themed('football'),
    });
    await chosen(app, token, session.id, ['football']);
    await put(
        app,
        token,
        themeUrl(session.id, 'football'),
        await readBody(app, token, session.id),
    );
    const opened = await studio(app, token, session.id);
    assert.equal(issueOf(opened, 'theme_unread'), undefined);

    const story = opened.blocks.find(({ kind }) => kind === 'story');
    assert.ok(story);
    const edit = await put(
        app,
        token,
        `/api/studio/sessions/${session.id}/blocks/${story.id}`,
        { content: story.content },
    );
    assert.equal(edit.statusCode, 200);
    const edited = await studio(app, token, session.id);
    assert.equal(edited.version, opened.version + 1);
    assert.equal(edited.themes[0].read, false);
    assert.deepEqual(issueOf(edited, 'theme_unread'), {
        code: 'theme_unread',
        themes: ['football'],
    });
    const blocked = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
        version: edited.version,
    });
    assert.equal(blocked.statusCode, 409);
    assert.equal(blocked.json().name, 'PUBLISH_BLOCKED');

    await setDrafting(app, session.id, 'football', 'generating');
    const revisions = `/api/studio/sessions/${session.id}/revisions`;
    const refused = await post(app, token, revisions, {});
    assert.equal(refused.statusCode, 409);
    assert.equal(refused.json().name, 'THEME_DRAFTING');
    await setDrafting(app, session.id, 'football', null);

    assert.equal((await post(app, token, revisions, {})).statusCode, 202);
    await settled(app, token, session.id);
    const revised = await studio(app, token, session.id);
    assert.equal(revised.drafting, null);
    assert.deepEqual(revised.themes, []);
    assert.equal(
        (
            await app.db
                .select({ id: sessionThemes.id })
                .from(sessionThemes)
                .where(eq(sessionThemes.learningSessionId, session.id))
        ).length,
        0,
    );
});

test('themes are hard issues: unread, drafting, failed, and mismatched block approval, and read themes publish', async (t) => {
    const { app, token, moduleId, session } = await themingApp(t, {
        football: themed('football'),
        music: themed('music'),
    });
    const plain = await studio(app, token, session.id);
    assert.deepEqual(plain.themes, []);
    assert.deepEqual(plain.issues, []);

    const opened = await chosen(app, token, session.id, ['football']);
    const approve = async (version: number) =>
        post(app, token, approval(session.id), {
            acknowledged: ['unreadable_pages'],
            version,
        });
    const expectBlocked = async (code: string) => {
        const now = await studio(app, token, session.id);
        assert.deepEqual(
            now.issues.filter((issue) => issue.code.startsWith('theme_')),
            [{ code, themes: ['football'] }],
        );
        const response = await approve(now.version);
        assert.equal(response.statusCode, 409);
        assert.equal(response.json().name, 'PUBLISH_BLOCKED');
    };

    assert.equal(opened.themes[0].read, false);
    await expectBlocked('theme_unread');
    await setDrafting(app, session.id, 'football', 'generating');
    await expectBlocked('theme_drafting');
    await setDrafting(app, session.id, 'football', 'failed');
    await expectBlocked('theme_failed');
    await setDrafting(app, session.id, 'football', null);
    await put(
        app,
        token,
        themeUrl(session.id, 'football'),
        await readBody(app, token, session.id),
    );

    const challenge = opened.blocks.find(({ kind }) => kind === 'challenge');
    assert.ok(challenge);
    const options = challenge.content.options as {
        id: string;
        label: string;
    }[];
    const moved = await put(
        app,
        token,
        `/api/studio/sessions/${session.id}/blocks/${challenge.id}`,
        {
            content: {
                ...challenge.content,
                options: [options[0], { ...options[1], label: '1/3' }],
            },
        },
    );
    assert.equal(moved.statusCode, 200);
    assert.equal(
        (await studio(app, token, session.id)).themes[0].mismatch,
        true,
    );
    await expectBlocked('theme_mismatch');

    const fresh = await draftedSession(app, token, moduleId);
    await chosen(app, token, fresh.id, ['football', 'music']);
    for (const theme of ['football', 'music']) {
        const response = await put(
            app,
            token,
            themeUrl(fresh.id, theme),
            await readBody(app, token, fresh.id),
        );
        assert.equal(response.statusCode, 200);
    }
    const ready = await studio(app, token, fresh.id);
    assert.deepEqual(ready.issues, []);
    const published = await post(app, token, approval(fresh.id), {
        acknowledged: ['unreadable_pages'],
        version: ready.version,
    });
    assert.equal(published.statusCode, 200);
    assert.equal(published.json().status, 'ready');
    assert.deepEqual(
        published.json().themes.map(({ theme }: { theme: string }) => theme),
        ['football', 'music'],
    );
});

test('end to end: two read themes publish and a student with a matching interest gets the theme', async (t) => {
    const { app, token, session } = await themingApp(t, {
        football: themed('football'),
        music: themed('music'),
    });
    await chosen(app, token, session.id, ['music', 'football']);
    for (const theme of ['football', 'music']) {
        await put(
            app,
            token,
            themeUrl(session.id, theme),
            await readBody(app, token, session.id),
        );
    }
    const ready = await studio(app, token, session.id);
    const published = await post(app, token, approval(session.id), {
        acknowledged: ['unreadable_pages'],
        version: ready.version,
    });
    assert.equal(published.statusCode, 200);
    const classroom = await createClass(app, token);
    await post(app, token, `/api/studio/sessions/${session.id}/assignments`, {
        classIds: [classroom.id],
    });
    const [assignment] = await app.db
        .select({ id: assignments.id })
        .from(assignments)
        .where(
            and(
                eq(assignments.learningSessionId, session.id),
                eq(assignments.classId, classroom.id),
            ),
        );
    const student = await demoStudent(app, classroom.id);
    await withInterests(app, student.id, ['music']);

    const started = await asStudent(
        app,
        student.token,
        'POST',
        `/assignments/${assignment.id}/attempt`,
    );
    assert.ok([200, 201].includes(started.statusCode), started.body);
    const detail = await asStudent(
        app,
        student.token,
        'GET',
        `/assignments/${assignment.id}`,
    );
    assert.match(detail.body, /Tema Musik: /);
    const [attempt] = await app.db
        .select({ theme: attempts.theme })
        .from(attempts)
        .where(eq(attempts.assignmentId, assignment.id));
    assert.equal(attempt?.theme, 'music');
});

const prefixed = (label: string) => (text: string) => `Tema ${label}: ${text}`;

async function themeOfAttempt(
    app: FastifyInstance,
    assignmentId: number,
    studentId: number,
) {
    const [row] = await app.db
        .select({ theme: attempts.theme })
        .from(attempts)
        .where(
            and(
                eq(attempts.assignmentId, assignmentId),
                eq(attempts.studentId, studentId),
            ),
        );
    assert.ok(row, 'the student has an attempt');
    return row.theme;
}

test('a student gets the first theme of their interests on start and keeps it: the detail, help, judging, done, and cards use the themed words', async (t) => {
    const app = await testApp(t);
    const demo = await demoClass(app);
    await seedTheme(app, demo.sessionId, 'music', prefixed('Musik'));
    await seedTheme(app, demo.sessionId, 'space', prefixed('Luar angkasa'));
    const student = await demoStudent(app, demo.classId);
    await withInterests(app, student.id, ['space', 'music']);
    const detailUrl = `/assignments/${demo.assignmentId}`;

    const before = await asStudent(app, student.token, 'GET', detailUrl);
    assert.doesNotMatch(before.body, /Tema /);

    const started = await asStudent(
        app,
        student.token,
        'POST',
        `${detailUrl}/attempt`,
    );
    assert.equal(started.statusCode, 201);
    assert.equal(
        await themeOfAttempt(app, demo.assignmentId, student.id),
        'space',
    );

    const detail = await asStudent(app, student.token, 'GET', detailUrl);
    assert.match(
        detail.body,
        /Tema Luar angkasa: Kamu dan si Jalak mau membagi 1 roti/,
    );
    assert.doesNotMatch(detail.body, /Tema Musik/);

    const attemptId: number = started.json().id;
    const blocks: { id: number; kind: string; content: Content }[] =
        detail.json().blocks;
    const blockId = (kind: string, index = 0) => {
        const block = blocks.filter((entry) => entry.kind === kind)[index];
        assert.ok(block, `the demo has ${kind} ${index + 1}`);
        return block.id;
    };
    const call = (path: string, payload: object) =>
        asStudent(
            app,
            student.token,
            'POST',
            `/attempts/${attemptId}${path}`,
            payload,
        );
    const themedText = (text: unknown) =>
        assert.match(String(text), /^Tema Luar angkasa: /);

    const hint = await call('/help', {
        blockId: blockId('check'),
        kind: 'hint',
    });
    const example = await call('/help', {
        blockId: blockId('check'),
        kind: 'example',
    });
    themedText(hint.json().earned.hints[0].text);
    themedText(example.json().earned.example.text);

    const right = await call('/responses', {
        blockId: blockId('check'),
        tryNumber: 1,
        answer: {
            kind: 'check',
            choice: 'b',
            reason: 'Karena tidak sama besar',
        },
    });
    assert.equal(right.json().outcome, 'correct');
    themedText(right.json().earned.praise);

    let last = right;
    for (const tryNumber of [1, 2, 3]) {
        last = await call('/responses', {
            blockId: blockId('check', 1),
            tryNumber,
            answer: { kind: 'check', choice: 'a' },
        });
        assert.equal(last.json().outcome, 'not_yet');
    }
    assert.equal(last.json().earned.reveal.answer, 'b');
    themedText(last.json().earned.reveal.text);

    const reflection = (understood: string[]) =>
        call('/responses', {
            blockId: blockId('reflection'),
            tryNumber: 1,
            answer: { kind: 'reflection', understood, confusing: [] },
        });
    assert.equal((await reflection(['Arti 1/4'])).statusCode, 400);
    assert.equal(
        (await reflection(['Tema Luar angkasa: Arti 1/4'])).statusCode,
        201,
    );

    const done = await asStudent(
        app,
        student.token,
        'POST',
        `/attempts/${attemptId}/submit`,
    );
    assert.equal(done.json().takeaways.length, 2);
    done.json().takeaways.forEach(themedText);

    const cards = await asStudent(app, student.token, 'GET', '/cards');
    assert.deepEqual(cards.json().cards[0].takeaways, done.json().takeaways);

    await withInterests(app, student.id, ['music']);
    assert.match(
        (await asStudent(app, student.token, 'GET', detailUrl)).body,
        /Tema Luar angkasa: /,
    );
    assert.equal(
        await themeOfAttempt(app, demo.assignmentId, student.id),
        'space',
    );

    for (const interests of [null, ['animals'] as Interest[]]) {
        const other = await demoStudent(app, demo.classId, 'Rina Putri');
        if (interests) await withInterests(app, other.id, interests);
        const response = await asStudent(
            app,
            other.token,
            'POST',
            `${detailUrl}/attempt`,
        );
        assert.equal(response.statusCode, 201);
        assert.equal(
            await themeOfAttempt(app, demo.assignmentId, other.id),
            null,
        );
        assert.doesNotMatch(
            (await asStudent(app, other.token, 'GET', detailUrl)).body,
            /Tema /,
        );
    }
});

test('Ulang Yuk and the teacher practice list show the themed prompt and hints of the student attempt', async (t) => {
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
    const app = await testApp(t);
    const demo = await demoClass(app);
    await seedTheme(app, demo.sessionId, 'music', prefixed('Musik'));
    const student = await demoStudent(app, demo.classId);
    await withInterests(app, student.id, ['music']);
    const attemptId = await takeDemo(app, student.token, demo.assignmentId);
    await runFor(app, attemptId, provider.config);

    const review = await asStudent(
        app,
        student.token,
        'GET',
        '/review?subject=mathematics',
    );
    const [question] = review.json().questions;
    assert.ok(question);
    assert.match(question.content.prompt, /^Tema Musik: /);

    const tried = await asStudent(app, student.token, 'POST', '/review/tries', {
        blockId: question.id,
        tryNumber: 1,
        answer: {
            kind: 'check',
            choice: 'a',
            reason: 'Karena bagiannya sama besar.',
        },
    });
    assert.equal(tried.json().outcome, 'not_yet');
    assert.match(tried.json().earned.hints[0].text, /^Tema Musik: /);

    const report = await get(
        app,
        demo.teacherToken,
        `/api/classes/${demo.classId}/students/${student.id}/report`,
    );
    assert.equal(report.statusCode, 200);
    assert.deepEqual(
        report.json().reviews.map(({ prompt }: { prompt: string }) => prompt),
        [question.content.prompt],
    );
});

test('the analysis and the summary read the themed questions without the theme key, and the evidence view names the theme', async (t) => {
    const provider = await stubProvider(t, [
        verdicts(),
        {
            body: completion(
                JSON.stringify({
                    summary:
                        'Siswa memahami bahwa pecahan perlu bagian yang sama besar dan sudah bisa memilihnya.',
                }),
            ),
        },
    ]);
    const app = await testApp(t);
    const demo = await demoClass(app, false, drawnDemoModule);
    await seedTheme(app, demo.sessionId, 'music', prefixed('Musik'));
    const student = await demoStudent(app, demo.classId);
    const waiting = await demoStudent(app, demo.classId, 'Rina Putri');
    await withInterests(app, student.id, ['music']);
    const attemptId = await takeDemo(app, student.token, demo.assignmentId);
    await runFor(app, attemptId, provider.config);
    const claimed = await claimSummary(app.db, { embedding: false, attemptId });
    assert.ok(claimed);
    await processSummary(app, claimed, provider.config, null);

    for (const request of provider.requests.slice(0, 2)) {
        const sent = request.body.messages[1]?.content ?? '';
        assert.match(sent, /Tema Musik: Roti ini dipotong jadi 4/);
        assert.ok(sent.includes(drawnLabel('soal', 4)));
        assert.doesNotMatch(sent, /music/);
    }

    const evidenceUrl = (studentId: number) =>
        `/api/classes/${demo.classId}/assignments/${demo.assignmentId}/students/${studentId}`;
    const evidence = await get(app, demo.teacherToken, evidenceUrl(student.id));
    assert.equal(evidence.statusCode, 200);
    assert.equal(evidence.json().theme, 'music');
    const questions: { question: string; diagram?: string }[] = evidence
        .json()
        .competencies.flatMap(
            ({ questions }: { questions: object[] }) => questions,
        );
    assert.ok(questions.length > 0);
    for (const { question } of questions) {
        assert.match(question, /^Tema Musik: /);
    }
    assert.ok(
        questions.some(({ diagram }) =>
            diagram?.includes(drawnLabel('soal', 4)),
        ),
    );
    assert.equal(
        (await get(app, demo.teacherToken, evidenceUrl(waiting.id))).json()
            .theme,
        null,
    );
});

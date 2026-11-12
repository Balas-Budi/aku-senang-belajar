import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completion, stubProvider } from './ai-stub.ts';
import { createUser, loginAs, testApp } from './helpers.ts';
import {
    draft,
    post,
    put,
    settled,
    teacherWithModule,
} from './studio-fixtures.ts';

const second = {
    ...draft,
    title: 'Roti untuk tetangga',
    episode: 'Si Jalak mengantar seperempat roti ke rumah tetangga.',
};

test('each misi stores its episode, the next misi of the chapter receives the earlier ones in order, and a revision carries its own', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
        { body: completion(JSON.stringify(second)) },
        { body: completion(JSON.stringify(second)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const create = async () =>
        (await post(app, token, `/api/modules/${moduleId}/sessions`, {})).json()
            .id as number;

    const firstId = await create();
    const first = await settled(app, token, firstId);
    assert.equal(first.episode, draft.episode);

    const [opening] = provider.requests[0].body.messages.map(
        ({ content }) => content,
    );
    assert.ok(opening.includes('si Jalak'));
    assert.ok(
        !provider.requests[0].body.messages[1].content.includes('Story so far'),
    );

    const secondId = await create();
    await settled(app, token, secondId);

    const user = provider.requests[1].body.messages[1].content;
    assert.ok(
        user.includes(
            `Story so far in this chapter, oldest first:\n1. ${draft.episode}`,
        ),
    );
    assert.ok(!user.includes(second.episode));

    const revised = await post(
        app,
        token,
        `/api/studio/sessions/${secondId}/revisions`,
        { note: 'Buat lebih singkat.' },
    );
    assert.equal(revised.statusCode, 202);
    await settled(app, token, secondId);

    const revision = provider.requests[2].body.messages[1].content;
    assert.ok(revision.includes(`1. ${draft.episode}`));
    assert.ok(revision.includes(`"episode":"${second.episode}"`));
});

test('the teacher edits or clears an episode; another teacher cannot', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion(JSON.stringify(draft)) },
    ]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const other = await loginAs(app, (await createUser(app)).username);
    const { id } = (
        await post(app, token, `/api/modules/${moduleId}/sessions`, {})
    ).json();
    await settled(app, token, id);
    const url = `/api/studio/sessions/${id}/episode`;

    const edited = await put(app, token, url, {
        episode: '  Kamu dan si Jalak membagi kue di pasar.  ',
    });
    assert.equal(edited.statusCode, 200);
    assert.equal(
        edited.json().episode,
        'Kamu dan si Jalak membagi kue di pasar.',
    );

    assert.equal(
        (await put(app, token, url, { episode: 'x'.repeat(301) })).statusCode,
        400,
    );
    assert.equal(
        (await put(app, token, url, { episode: '' })).json().episode,
        null,
    );
    assert.equal(
        (await put(app, other, url, { episode: 'Lain.' })).statusCode,
        404,
    );
});

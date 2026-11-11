import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    checkDraft,
    mendDraft,
    sessionDraft,
} from '../src/studio/session-draft.ts';
import { completion, stubProvider } from './ai-stub.ts';
import { testApp } from './helpers.ts';
import { draft, draftedSession, teacherWithModule } from './studio-fixtures.ts';

const whole = JSON.stringify(draft);
const unclosed = whole.replace(
    '},"competencies":["C2"],"pages":[4]',
    ',"competencies":["C2"],"pages":[4]',
);
const cutShort = whole.replace(
    '],"example":{"text":"Kue yang dipotong empat sama besar juga perempat."},"reveal":"Roti A, karena keempat potongannya sama besar."},"competencies":["C1"],"pages":[1]',
    ',"competencies":["C1"],"pages":[1]',
);

test('mendDraft closes a screen the model left open before its competencies, and leaves a whole draft alone', () => {
    assert.notEqual(unclosed, whole);
    assert.notEqual(cutShort, whole);
    assert.throws(() => JSON.parse(unclosed));
    assert.throws(() => JSON.parse(cutShort));

    assert.equal(mendDraft(whole), whole);
    assert.deepEqual(JSON.parse(mendDraft(unclosed)), JSON.parse(whole));

    const mended = sessionDraft.parse(JSON.parse(mendDraft(cutShort)));

    assert.deepEqual(Object.keys(mended.blocks[2].content), [
        'prompt',
        'options',
        'answer',
        'praise',
        'hints',
    ]);
    assert.match(
        checkDraft(['C1', 'C2'], [1, 3, 4])(mended) ?? '',
        /Block 3 \(check\): example /,
    );
});

test('a draft whose JSON lacks one closing brace is stored without a second model turn', async (t) => {
    const provider = await stubProvider(t, [{ body: completion(unclosed) }]);
    const app = await testApp(t, provider.config);
    const { token, moduleId } = await teacherWithModule(app);
    const session = await draftedSession(app, token, moduleId);

    assert.equal(session.drafting, null);
    assert.equal(session.blocks.at(-1)?.kind, 'extra_challenge');
    assert.equal(provider.requests.length, 1);
});

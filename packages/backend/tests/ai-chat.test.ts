import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test, type TestContext } from 'node:test';
import { z } from 'zod';
import {
    aiConfig,
    AiError,
    chatJson,
    requireAiConfig,
} from '../src/ai/chat.ts';
import { loadEnv } from '../src/env.ts';

type Reply = { status?: number; body?: unknown; delay?: number };

const requestBody = z.object({
    model: z.string(),
    messages: z.array(z.object({ role: z.string(), content: z.string() })),
    response_format: z.object({ type: z.string() }),
});

const verdict = z.object({ status: z.enum(['visible', 'developing']) });

function completion(content: string) {
    return {
        model: 'provider-model-name',
        choices: [{ message: { role: 'assistant', content } }],
    };
}

async function stubProvider(t: TestContext, replies: Reply[]) {
    const requests: {
        path: string | undefined;
        authorization: string | undefined;
        body: z.infer<typeof requestBody>;
    }[] = [];
    const server = createServer(async (request, response) => {
        const chunks: Buffer[] = [];

        for await (const chunk of request) chunks.push(chunk);

        requests.push({
            path: request.url,
            authorization: request.headers.authorization,
            body: requestBody.parse(
                JSON.parse(Buffer.concat(chunks).toString('utf8')),
            ),
        });

        const reply = replies.shift() ?? { status: 500 };

        if (reply.delay) {
            await new Promise((done) => setTimeout(done, reply.delay));
        }

        response.writeHead(reply.status ?? 200, {
            'content-type': 'application/json',
        });
        response.end(JSON.stringify(reply.body ?? {}));
    });

    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    t.after(() => {
        server.closeAllConnections();
        server.close();
    });

    const address = server.address();

    assert.ok(address && typeof address === 'object');

    return {
        requests,
        config: {
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            apiKey: 'test-key',
            model: 'test-model',
        },
    };
}

const ask = { system: 'Reply in JSON.', user: 'Judge this answer.' };

function failsWith(failure: string) {
    return (error: unknown) =>
        error instanceof AiError && error.failure === failure;
}

test('a valid JSON reply comes back parsed, with the model the provider named', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion('{"status":"visible"}') },
    ]);

    const result = await chatJson(provider.config, {
        ...ask,
        schema: verdict,
    });

    assert.deepEqual(result, {
        value: { status: 'visible' },
        model: 'provider-model-name',
    });
    assert.equal(provider.requests.length, 1);
    assert.equal(provider.requests[0].path, '/v1/chat/completions');
    assert.equal(provider.requests[0].authorization, 'Bearer test-key');
    assert.equal(provider.requests[0].body.model, 'test-model');
    assert.equal(provider.requests[0].body.response_format.type, 'json_object');
    assert.deepEqual(provider.requests[0].body.messages, [
        { role: 'system', content: ask.system },
        { role: 'user', content: ask.user },
    ]);
});

test('a reply inside a code fence is read as JSON', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion('```json\n{"status":"developing"}\n```') },
    ]);

    const result = await chatJson(provider.config, {
        ...ask,
        schema: verdict,
    });

    assert.deepEqual(result.value, { status: 'developing' });
});

test('a reply that is not JSON is retried once with the problem named', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion('The student understands.') },
        { body: completion('{"status":"visible"}') },
    ]);

    const result = await chatJson(provider.config, {
        ...ask,
        schema: verdict,
    });

    assert.deepEqual(result.value, { status: 'visible' });
    assert.equal(provider.requests.length, 2);

    const retry = provider.requests[1].body.messages;

    assert.deepEqual(
        retry.map((message) => message.role),
        ['system', 'user', 'assistant', 'user'],
    );
    assert.equal(retry[2].content, 'The student understands.');
    assert.match(retry[3].content, /not valid JSON/);
});

test('a reply that fails twice ends as invalid output after two requests', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion('{"status":"mastered"}') },
        { body: completion('{"state":"visible"}') },
    ]);

    await assert.rejects(
        chatJson(provider.config, { ...ask, schema: verdict }),
        failsWith('invalid_output'),
    );
    assert.equal(provider.requests.length, 2);
    assert.match(provider.requests[1].body.messages[3].content, /schema/);
});

test('a check that refuses the value counts as a problem to correct', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion('{"status":"visible"}') },
        { body: completion('{"status":"developing"}') },
    ]);

    const result = await chatJson(provider.config, {
        ...ask,
        schema: verdict,
        check: (value) =>
            value.status === 'visible'
                ? 'A visible status needs a cited answer.'
                : null,
    });

    assert.deepEqual(result.value, { status: 'developing' });
    assert.match(
        provider.requests[1].body.messages[3].content,
        /needs a cited answer/,
    );
});

test('a provider slower than the timeout ends as a timeout', async (t) => {
    const provider = await stubProvider(t, [
        { body: completion('{"status":"visible"}'), delay: 500 },
    ]);

    await assert.rejects(
        chatJson(provider.config, { ...ask, schema: verdict }, 50),
        failsWith('timeout'),
    );
});

test('an error status ends as an http failure that never names the key', async (t) => {
    const provider = await stubProvider(t, [{ status: 503 }]);

    await assert.rejects(
        chatJson(provider.config, { ...ask, schema: verdict }),
        (error: unknown) =>
            error instanceof AiError &&
            error.failure === 'http' &&
            error.status === 503 &&
            !error.message.includes('test-key'),
    );
});

test('the AI settings come from the env, and a blank or missing one leaves AI off', () => {
    const base = { DATABASE_URL: 'postgresql://app@localhost:5432/app' };
    const configured = loadEnv({
        ...base,
        AI_BASE_URL: 'https://ai.example/v1/chat/completions',
        AI_API_KEY: 'secret',
        AI_MODEL: 'a-model',
    });
    const blankKey = loadEnv({
        ...base,
        AI_BASE_URL: 'https://ai.example/v1/',
        AI_API_KEY: '',
        AI_MODEL: 'a-model',
    });

    assert.deepEqual(aiConfig(configured), {
        baseUrl: 'https://ai.example/v1',
        apiKey: 'secret',
        model: 'a-model',
    });
    assert.equal(blankKey.AI_BASE_URL, 'https://ai.example/v1');
    assert.equal(aiConfig(blankKey), null);
    assert.equal(aiConfig(loadEnv(base)), null);
    assert.throws(
        () => requireAiConfig(loadEnv(base)),
        failsWith('not_configured'),
    );
});

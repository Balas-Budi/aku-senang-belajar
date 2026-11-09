import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiError } from '../src/ai/chat.ts';
import { embedConfig, embedTexts } from '../src/ai/embed.ts';
import { loadEnv } from '../src/env.ts';
import { basis, stubEmbedder } from './ai-stub.ts';

function failsWith(failure: string) {
    return (error: unknown) =>
        error instanceof AiError && error.failure === failure;
}

test('texts come back as 1536-number vectors from the embedding provider', async (t) => {
    const provider = await stubEmbedder(t, (texts) => ({
        vectors: texts.map((_, index) => basis(index)),
    }));

    const vectors = await embedTexts(provider.config, [
        'A fraction is part of a whole.',
        'One quarter is written 1/4.',
    ]);

    assert.equal(vectors.length, 2);
    assert.equal(vectors[0].length, 1536);
    assert.equal(vectors[1][1], 1);
    assert.equal(provider.requests.length, 1);
    assert.equal(provider.requests[0].path, '/v1/embeddings');
    assert.equal(provider.requests[0].authorization, 'Bearer test-key');
    assert.equal(provider.requests[0].body.model, 'test-embedding-model');
    assert.equal(provider.requests[0].body.dimensions, 1536);
    assert.equal(provider.requests[0].body.encoding_format, 'float');
    assert.deepEqual(provider.requests[0].body.input, [
        'A fraction is part of a whole.',
        'One quarter is written 1/4.',
    ]);
});

test('vectors of the wrong size end as invalid output', async (t) => {
    const provider = await stubEmbedder(t, (texts) => ({
        vectors: texts.map(() => [0.1, 0.2, 0.3]),
    }));

    await assert.rejects(
        embedTexts(provider.config, ['A fraction is part of a whole.']),
        failsWith('invalid_output'),
    );
});

test('an error status ends as an http failure that never names the key', async (t) => {
    const provider = await stubEmbedder(t, () => ({ status: 503 }));

    await assert.rejects(
        embedTexts(provider.config, ['A fraction is part of a whole.']),
        (error: unknown) =>
            error instanceof AiError &&
            error.failure === 'http' &&
            error.status === 503 &&
            !error.message.includes('test-key'),
    );
});

test('a provider slower than the timeout ends as a timeout', async (t) => {
    const provider = await stubEmbedder(t, (texts) => ({
        vectors: texts.map((_, index) => basis(index)),
        delay: 500,
    }));

    await assert.rejects(
        embedTexts(provider.config, ['A fraction is part of a whole.'], 50),
        failsWith('timeout'),
    );
});

test('the embedding settings come from their own env, and a blank or missing one leaves embeddings off', () => {
    const base = { DATABASE_URL: 'postgresql://app@localhost:5432/app' };
    const configured = loadEnv({
        ...base,
        AI_EMBED_BASE_URL: 'https://embed.example/v1/embeddings',
        AI_EMBED_API_KEY: 'secret',
        AI_EMBED_MODEL: 'an-embedding-model',
    });
    const blankKey = loadEnv({
        ...base,
        AI_EMBED_BASE_URL: 'https://embed.example/v1/',
        AI_EMBED_API_KEY: '',
        AI_EMBED_MODEL: 'an-embedding-model',
    });

    assert.deepEqual(embedConfig(configured), {
        baseUrl: 'https://embed.example/v1',
        apiKey: 'secret',
        model: 'an-embedding-model',
    });
    assert.equal(embedConfig(blankKey), null);
    assert.equal(embedConfig(loadEnv(base)), null);
});

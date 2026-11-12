import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { TestContext } from 'node:test';
import { z } from 'zod';
import { EMBEDDING_DIMENSIONS } from '../src/db/schema.ts';

const requestBody = z.object({
    model: z.string(),
    messages: z.array(
        z.object({
            role: z.string(),
            content: z
                .union([z.string(), z.array(z.record(z.string(), z.unknown()))])
                .transform((content) =>
                    typeof content === 'string'
                        ? content
                        : content
                              .map((part) =>
                                  typeof part.text === 'string'
                                      ? part.text
                                      : '',
                              )
                              .join(''),
                ),
        }),
    ),
    response_format: z.object({ type: z.string() }),
});

export type ProviderRequest = {
    path: string | undefined;
    authorization: string | undefined;
    text: string;
    body: z.infer<typeof requestBody>;
};

type Answer = {
    status?: number;
    body?: unknown;
    delay?: number;
    gate?: Promise<unknown>;
};

export type Reply = Answer | ((request: ProviderRequest) => Answer);

export function completion(content: string, finishReason = 'stop') {
    return {
        model: 'provider-model-name',
        choices: [
            {
                message: { role: 'assistant', content },
                finish_reason: finishReason,
            },
        ],
        usage: {
            prompt_tokens: 100,
            completion_tokens: 42,
            total_tokens: 142,
        },
    };
}

export async function stubProvider(t: TestContext, replies: Reply[]) {
    const requests: ProviderRequest[] = [];
    const server = createServer(async (request, response) => {
        const chunks: Buffer[] = [];

        for await (const chunk of request) chunks.push(chunk);

        const text = Buffer.concat(chunks).toString('utf8');
        const received = {
            path: request.url,
            authorization: request.headers.authorization,
            text,
            body: requestBody.parse(JSON.parse(text)),
        };

        requests.push(received);

        const next = replies.shift() ?? { status: 500 };
        const reply = typeof next === 'function' ? next(received) : next;

        if (reply.delay) {
            await new Promise((done) => setTimeout(done, reply.delay));
        }

        await reply.gate;
        response.writeHead(reply.status ?? 200, {
            'content-type': 'application/json',
        });
        response.end(JSON.stringify(reply.body ?? {}));
    });

    return {
        requests,
        config: { ...(await listen(t, server)), model: 'test-model' },
    };
}

async function listen(t: TestContext, server: Server) {
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    t.after(() => {
        server.closeAllConnections();
        server.close();
    });

    const address = server.address();

    assert.ok(address && typeof address === 'object');

    return {
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: 'test-key',
    };
}

const embeddingBody = z.object({
    model: z.string(),
    input: z.union([z.string(), z.array(z.string())]),
    dimensions: z.number().optional(),
    encoding_format: z.string().optional(),
});

export type EmbeddingRequest = {
    path: string | undefined;
    authorization: string | undefined;
    body: z.infer<typeof embeddingBody>;
};

export type EmbeddingAnswer = {
    status?: number;
    vectors?: number[][];
    delay?: number;
};

export function basis(index: number) {
    return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, position) =>
        position === index ? 1 : 0,
    );
}

export async function stubEmbedder(
    t: TestContext,
    answer: (texts: string[]) => EmbeddingAnswer,
) {
    const requests: EmbeddingRequest[] = [];
    const server = createServer(async (request, response) => {
        const chunks: Buffer[] = [];

        for await (const chunk of request) chunks.push(chunk);

        const body = embeddingBody.parse(
            JSON.parse(Buffer.concat(chunks).toString('utf8')),
        );
        const texts =
            typeof body.input === 'string' ? [body.input] : body.input;
        const reply = answer(texts);

        requests.push({
            path: request.url,
            authorization: request.headers.authorization,
            body,
        });

        if (reply.delay) {
            await new Promise((done) => setTimeout(done, reply.delay));
        }

        response.writeHead(reply.status ?? 200, {
            'content-type': 'application/json',
        });
        response.end(
            JSON.stringify(
                reply.status
                    ? {}
                    : {
                          object: 'list',
                          data: (reply.vectors ?? []).map(
                              (embedding, index) => ({
                                  object: 'embedding',
                                  index,
                                  embedding,
                              }),
                          ),
                          model: 'provider-embedding-model',
                          usage: {
                              prompt_tokens: texts.length,
                              total_tokens: texts.length,
                          },
                      },
            ),
        );
    });

    return {
        requests,
        config: {
            ...(await listen(t, server)),
            model: 'test-embedding-model',
        },
    };
}

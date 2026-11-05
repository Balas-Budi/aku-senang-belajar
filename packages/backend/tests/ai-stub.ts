import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { TestContext } from 'node:test';
import { z } from 'zod';

const requestBody = z.object({
    model: z.string(),
    messages: z.array(z.object({ role: z.string(), content: z.string() })),
    response_format: z.object({ type: z.string() }),
});

export type ProviderRequest = {
    path: string | undefined;
    authorization: string | undefined;
    text: string;
    body: z.infer<typeof requestBody>;
};

type Answer = { status?: number; body?: unknown; delay?: number };

export type Reply = Answer | ((request: ProviderRequest) => Answer);

export function completion(content: string) {
    return {
        model: 'provider-model-name',
        choices: [{ message: { role: 'assistant', content } }],
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

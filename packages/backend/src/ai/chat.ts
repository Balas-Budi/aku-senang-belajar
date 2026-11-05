import { z, type ZodType } from 'zod';
import type { Env } from '../env.ts';

export type AiConfig = { baseUrl: string; apiKey: string; model: string };

export type AiFailure =
    'not_configured' | 'network' | 'timeout' | 'http' | 'invalid_output';

export class AiError extends Error {
    readonly failure: AiFailure;
    readonly status?: number;

    constructor(failure: AiFailure, message: string, status?: number) {
        super(message);
        this.name = this.constructor.name;
        this.failure = failure;
        this.status = status;
    }
}

export type ChatJsonRequest<T> = {
    system: string;
    user: string;
    schema: ZodType<T>;
    check?: (value: T) => string | null;
};

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

const completion = z.object({
    model: z.string().optional(),
    choices: z
        .array(z.object({ message: z.object({ content: z.string() }) }))
        .min(1),
});

const defaultTimeout = 60_000;

export function aiConfig(env: Env): AiConfig | null {
    const { AI_BASE_URL: baseUrl, AI_API_KEY: apiKey, AI_MODEL: model } = env;

    return baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null;
}

export function requireAiConfig(env: Env): AiConfig {
    const config = aiConfig(env);

    if (!config) {
        throw new AiError(
            'not_configured',
            'AI_BASE_URL, AI_API_KEY, and AI_MODEL are not all set',
        );
    }

    return config;
}

async function complete(
    config: AiConfig,
    messages: Message[],
    timeoutMs: number,
) {
    try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${config.apiKey}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                response_format: { type: 'json_object' },
            }),
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
            await response.body?.cancel();
            throw new AiError(
                'http',
                `The AI provider answered ${response.status}`,
                response.status,
            );
        }

        const reply = completion.safeParse(await response.json());

        if (!reply.success) {
            throw new AiError(
                'invalid_output',
                'The AI provider replied without message content',
            );
        }

        return {
            content: reply.data.choices[0].message.content,
            model: reply.data.model ?? config.model,
        };
    } catch (error) {
        if (error instanceof AiError) throw error;
        if (error instanceof Error && error.name === 'TimeoutError') {
            throw new AiError('timeout', `No reply within ${timeoutMs} ms`);
        }
        if (error instanceof SyntaxError) {
            throw new AiError(
                'invalid_output',
                'The AI provider replied with something other than JSON',
            );
        }
        throw new AiError('network', 'The AI provider could not be reached');
    }
}

function readReply<T>(
    content: string,
    request: ChatJsonRequest<T>,
): { value: T } | { problem: string } {
    const text = content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
    let json: unknown;

    try {
        json = JSON.parse(text);
    } catch {
        return { problem: 'Your reply was not valid JSON.' };
    }

    const parsed = request.schema.safeParse(json);

    if (!parsed.success) {
        const issues = parsed.error.issues
            .map(
                (issue) =>
                    `${issue.path.join('.') || 'root'}: ${issue.message}`,
            )
            .join('; ');

        return { problem: `Your JSON did not match the schema (${issues}).` };
    }

    const problem = request.check?.(parsed.data);

    return problem ? { problem } : { value: parsed.data };
}

export async function chatJson<T>(
    config: AiConfig,
    request: ChatJsonRequest<T>,
    timeoutMs = defaultTimeout,
) {
    const messages: Message[] = [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
    ];
    const first = await complete(config, messages, timeoutMs);
    const firstReply = readReply(first.content, request);

    if ('value' in firstReply) {
        return { value: firstReply.value, model: first.model };
    }

    messages.push(
        { role: 'assistant', content: first.content },
        {
            role: 'user',
            content: `${firstReply.problem} Reply again with only the corrected JSON object.`,
        },
    );

    const second = await complete(config, messages, timeoutMs);
    const secondReply = readReply(second.content, request);

    if ('value' in secondReply) {
        return { value: secondReply.value, model: second.model };
    }

    throw new AiError('invalid_output', secondReply.problem);
}

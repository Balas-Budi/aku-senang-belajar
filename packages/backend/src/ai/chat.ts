import {
    AIMessage,
    HumanMessage,
    SystemMessage,
    type BaseMessage,
} from '@langchain/core/messages';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAICompletions } from '@langchain/openai';
import type { ZodType } from 'zod';
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

const defaultTimeout = 60_000;
const maxTurns = 2;

const Turn = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (current, added) => current.concat(added),
        default: () => [],
    }),
    reply: Annotation<string>,
    problem: Annotation<string | null>,
    turns: Annotation<number>,
});

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

function failureOf(error: unknown, timeoutMs: number): AiError {
    if (error instanceof AiError) return error;
    if (error instanceof Error && error.name === 'TimeoutError') {
        return new AiError('timeout', `No reply within ${timeoutMs} ms`);
    }
    if (error instanceof SyntaxError) {
        return new AiError(
            'invalid_output',
            'The AI provider replied with something other than JSON',
        );
    }
    if (
        error instanceof Error &&
        'status' in error &&
        typeof error.status === 'number'
    ) {
        return new AiError(
            'http',
            `The AI provider answered ${error.status}`,
            error.status,
        );
    }

    return new AiError('network', 'The AI provider could not be reached');
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
    const model = new ChatOpenAICompletions({
        model: config.model,
        apiKey: config.apiKey,
        configuration: { baseURL: config.baseUrl },
        timeout: timeoutMs,
        maxRetries: 0,
    });
    let accepted: { value: T; model: string } | undefined;
    const graph = new StateGraph(Turn)
        .addNode('ask', async (state) => {
            const reply = await model.invoke(state.messages, {
                response_format: { type: 'json_object' },
            });
            const name = reply.response_metadata.model_name;
            const result = readReply(reply.text, request);

            if ('value' in result) {
                accepted = {
                    value: result.value,
                    model: typeof name === 'string' ? name : config.model,
                };
            }

            return {
                reply: reply.text,
                problem: 'problem' in result ? result.problem : null,
                turns: state.turns + 1,
            };
        })
        .addNode('repair', (state) => ({
            messages: [
                new AIMessage(state.reply),
                new HumanMessage(
                    `${state.problem} Reply again with only the corrected JSON object.`,
                ),
            ],
        }))
        .addEdge(START, 'ask')
        .addConditionalEdges('ask', (state) =>
            state.problem && state.turns < maxTurns ? 'repair' : END,
        )
        .addEdge('repair', 'ask')
        .compile();
    let final: typeof Turn.State;

    try {
        final = await graph.invoke({
            messages: [
                new SystemMessage(request.system),
                new HumanMessage(request.user),
            ],
            problem: null,
            turns: 0,
        });
    } catch (error) {
        throw failureOf(error, timeoutMs);
    }

    if (accepted) return accepted;

    throw new AiError(
        'invalid_output',
        final.problem ?? 'The AI provider gave no usable reply',
    );
}

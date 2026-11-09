import { OpenAIEmbeddings } from '@langchain/openai';
import { EMBEDDING_DIMENSIONS } from '../db/schema.ts';
import type { Env } from '../env.ts';
import { AiError, aiFailureOf } from './chat.ts';

export type EmbedConfig = { baseUrl: string; apiKey: string; model: string };

const defaultTimeout = 60_000;

export function embedConfig(env: Env): EmbedConfig | null {
    const {
        AI_EMBED_BASE_URL: baseUrl,
        AI_EMBED_API_KEY: apiKey,
        AI_EMBED_MODEL: model,
    } = env;

    return baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null;
}

export async function embedTexts(
    config: EmbedConfig,
    texts: string[],
    timeoutMs = defaultTimeout,
): Promise<number[][]> {
    const embeddings = new OpenAIEmbeddings({
        model: config.model,
        apiKey: config.apiKey,
        configuration: { baseURL: config.baseUrl },
        dimensions: EMBEDDING_DIMENSIONS,
        encodingFormat: 'float',
        timeout: timeoutMs,
        maxRetries: 0,
    });
    let vectors: number[][];

    try {
        vectors = await embeddings.embedDocuments(texts);
    } catch (error) {
        throw aiFailureOf(error, timeoutMs);
    }

    if (
        vectors.length !== texts.length ||
        vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)
    ) {
        throw new AiError(
            'invalid_output',
            `The embedding provider did not return ${texts.length} vectors of ${EMBEDDING_DIMENSIONS} numbers`,
        );
    }

    return vectors;
}

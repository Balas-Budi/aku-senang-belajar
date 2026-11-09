import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import {
    and,
    asc,
    cosineDistance,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    lt,
    lte,
    notExists,
    sql,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { AiError } from '../ai/chat.ts';
import { type EmbedConfig, embedConfig, embedTexts } from '../ai/embed.ts';
import type { Database } from '../db/index.ts';
import { materialChunks, materialPages } from '../db/schema.ts';

export const MAX_EMBED_TRIES = 3;

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 150,
});

export async function chunkPages(pages: (string | null)[]) {
    const chunks: { pageNumber: number; position: number; text: string }[] = [];

    for (const [index, text] of pages.entries()) {
        if (!text?.trim()) continue;

        const parts = await splitter.splitText(text);

        parts.forEach((part, position) =>
            chunks.push({ pageNumber: index + 1, position, text: part }),
        );
    }

    return chunks;
}

export async function chunkStoredMaterials(
    db: Database,
    only: { materialId?: number } = {},
) {
    const pending = await db
        .selectDistinct({ materialId: materialPages.materialId })
        .from(materialPages)
        .where(
            and(
                isNotNull(materialPages.text),
                only.materialId === undefined
                    ? undefined
                    : eq(materialPages.materialId, only.materialId),
                notExists(
                    db
                        .select({ id: materialChunks.id })
                        .from(materialChunks)
                        .where(
                            eq(
                                materialChunks.materialId,
                                materialPages.materialId,
                            ),
                        ),
                ),
            ),
        )
        .orderBy(asc(materialPages.materialId));

    for (const { materialId } of pending) {
        const pages = await db
            .select({ number: materialPages.number, text: materialPages.text })
            .from(materialPages)
            .where(eq(materialPages.materialId, materialId))
            .orderBy(asc(materialPages.number));
        const byNumber = new Map(pages.map((page) => [page.number, page.text]));
        const last = Math.max(...pages.map((page) => page.number));
        const chunks = await chunkPages(
            Array.from(
                { length: last },
                (_, index) => byNumber.get(index + 1) ?? null,
            ),
        );

        if (chunks.length > 0) {
            await db
                .insert(materialChunks)
                .values(chunks.map((chunk) => ({ ...chunk, materialId })))
                .onConflictDoNothing();
        }
    }

    return pending.length;
}

export async function retryFailedChunks(
    db: Database,
    only: { materialId?: number } = {},
) {
    const retried = await db
        .update(materialChunks)
        .set({ tries: 0, embedAfter: new Date() })
        .where(
            and(
                isNull(materialChunks.embedding),
                gte(materialChunks.tries, MAX_EMBED_TRIES),
                only.materialId === undefined
                    ? undefined
                    : eq(materialChunks.materialId, only.materialId),
            ),
        )
        .returning({ id: materialChunks.id });

    return retried.length;
}

export async function embedNextChunks(
    app: FastifyInstance,
    config: EmbedConfig,
    { limit = 32, materialId }: { limit?: number; materialId?: number } = {},
) {
    const claimed = await app.db.transaction(async (tx) => {
        const rows = await tx
            .select({
                id: materialChunks.id,
                text: materialChunks.text,
                tries: materialChunks.tries,
            })
            .from(materialChunks)
            .where(
                and(
                    isNull(materialChunks.embedding),
                    lt(materialChunks.tries, MAX_EMBED_TRIES),
                    lte(materialChunks.embedAfter, new Date()),
                    materialId === undefined
                        ? undefined
                        : eq(materialChunks.materialId, materialId),
                ),
            )
            .orderBy(asc(materialChunks.id))
            .limit(limit)
            .for('update', { skipLocked: true });

        if (rows.length > 0) {
            await tx
                .update(materialChunks)
                .set({ tries: sql`${materialChunks.tries} + 1` })
                .where(
                    inArray(
                        materialChunks.id,
                        rows.map((row) => row.id),
                    ),
                );
        }

        return rows;
    });

    if (claimed.length === 0) return false;

    const ids = claimed.map((row) => row.id);

    try {
        const vectors = await embedTexts(
            config,
            claimed.map((row) => row.text),
        );
        const embeddedAt = new Date();

        await app.db.transaction(async (tx) => {
            for (const [index, row] of claimed.entries()) {
                await tx
                    .update(materialChunks)
                    .set({ embedding: vectors[index], embeddedAt })
                    .where(eq(materialChunks.id, row.id));
            }
        });

        return true;
    } catch (error) {
        const tries = Math.max(...claimed.map((row) => row.tries)) + 1;
        const delay = tries === 1 ? 60_000 : 5 * 60_000;

        await app.db
            .update(materialChunks)
            .set({ embedAfter: new Date(Date.now() + delay) })
            .where(inArray(materialChunks.id, ids));
        app.log.warn(
            {
                chunks: ids.length,
                tries,
                failure: error instanceof AiError ? error.failure : 'error',
            },
            'Embedding a batch of material chunks failed',
        );

        return false;
    }
}

export function startEmbeddingRunner(
    app: FastifyInstance,
    { everyMs = 15_000 }: { everyMs?: number } = {},
) {
    let timer: NodeJS.Timeout | undefined;
    let draining: Promise<void> | null = null;
    let closing = false;

    async function drain() {
        const config = embedConfig(app.env);

        if (!config) return;

        try {
            for (let more = true; more && !closing;) {
                more = await embedNextChunks(app, config);
            }
        } catch (error) {
            app.log.error(error, 'The embedding runner stopped a round');
        }
    }

    function tick() {
        draining ??= drain().finally(() => {
            draining = null;
        });
    }

    app.addHook('onReady', async () => {
        timer = setInterval(tick, everyMs);
        tick();
    });
    app.addHook('onClose', async () => {
        closing = true;
        clearInterval(timer);
        await draining;
    });
}

export async function searchMaterial(
    db: Database,
    config: EmbedConfig,
    materialId: number,
    query: string,
    limit = 5,
) {
    const [vector] = await embedTexts(config, [query]);
    const distance =
        sql<number>`${cosineDistance(materialChunks.embedding, vector)}`.mapWith(
            Number,
        );

    return db
        .select({
            pageNumber: materialChunks.pageNumber,
            position: materialChunks.position,
            text: materialChunks.text,
            distance,
        })
        .from(materialChunks)
        .where(
            and(
                eq(materialChunks.materialId, materialId),
                isNotNull(materialChunks.embedding),
            ),
        )
        .orderBy(distance)
        .limit(limit);
}

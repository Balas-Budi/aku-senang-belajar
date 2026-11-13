import {
    and,
    eq,
    inArray,
    isNull,
    or,
    sql,
    TransactionRollbackError,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AiError, aiConfig, chatJson } from '../ai/chat.ts';
import type { Queryable } from '../db/index.ts';
import {
    INTERESTS,
    learningSessions,
    materials,
    modules,
    sessionBlocks,
    sessionBlockThemes,
    sessionThemes,
    type Interest,
} from '../db/schema.ts';
import {
    sessionBlock,
    themeProblems,
    withoutDiagrams,
    withTheme,
} from '../learning/blocks.ts';
import { inBackground } from '../lib/background.ts';
import { blocksWithCodes, DRAFT_TIMEOUT_MS, DRAFT_TURNS } from './drafting.ts';
import {
    checkTheme,
    THEME_PROMPT_VERSION,
    THEME_SYSTEM_PROMPT,
    themeCutOff,
    themedContent,
    themeMessage,
    themeReply,
    type BaseBlock,
    type ThemeReply,
} from './theme-draft.ts';
import { materialSubjectName } from '../subjects.ts';

export async function baseBlocks(
    db: Queryable,
    sessionId: number,
): Promise<BaseBlock[]> {
    return (await blocksWithCodes(db, sessionId))
        .filter(({ kind }) => kind !== 'brain_game')
        .map(({ id, position, kind, content }) => ({
            id,
            position,
            block: sessionBlock.parse({ kind, content }),
        }));
}

async function themeContext(db: Queryable, sessionId: number, rowId: number) {
    const [row] = await db
        .select({
            theme: sessionThemes.theme,
            title: modules.title,
            subject: materialSubjectName,
            grade: materials.grade,
        })
        .from(sessionThemes)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, sessionThemes.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(sessionThemes.id, rowId),
                eq(sessionThemes.learningSessionId, sessionId),
            ),
        );

    if (!row) return null;

    const theme = z.enum(INTERESTS).parse(row.theme);
    const base = await baseBlocks(db, sessionId);
    const stored = await db
        .select({
            blockId: sessionBlockThemes.blockId,
            content: sessionBlockThemes.content,
        })
        .from(sessionBlockThemes)
        .where(
            and(
                eq(sessionBlockThemes.theme, theme),
                inArray(
                    sessionBlockThemes.blockId,
                    base.map(({ id }) => id),
                ),
            ),
        );

    return {
        theme,
        module: { title: row.title, subject: row.subject, grade: row.grade },
        base,
        current: new Map(
            stored.map(({ blockId, content }) => [blockId, content]),
        ),
    };
}

async function storeTheme(
    db: Queryable,
    sessionId: number,
    rowId: number,
    theme: Interest,
    base: BaseBlock[],
    reply: ThemeReply,
    model: string,
) {
    const contents = new Map(
        reply.blocks.map(({ screen, content }) => [screen, content]),
    );
    const rows = base.map(({ id, position, block }) => ({
        blockId: id,
        theme,
        content: withoutDiagrams(
            withTheme(block, contents.get(position)).content,
        ),
    }));

    try {
        await db.transaction(async (tx) => {
            const [session] = await tx
                .update(learningSessions)
                .set({ version: sql`${learningSessions.version} + 1` })
                .where(
                    and(
                        eq(learningSessions.id, sessionId),
                        eq(learningSessions.status, 'draft'),
                        or(
                            isNull(learningSessions.drafting),
                            eq(learningSessions.drafting, 'failed'),
                        ),
                    ),
                )
                .returning({ id: learningSessions.id });

            if (!session) {
                throw new Error(
                    `Session ${sessionId} is no longer an idle draft`,
                );
            }

            const [claimed] = await tx
                .update(sessionThemes)
                .set({
                    drafting: null,
                    draftError: null,
                    model,
                    promptVersion: THEME_PROMPT_VERSION,
                    readBy: null,
                    readAt: null,
                })
                .where(
                    and(
                        eq(sessionThemes.id, rowId),
                        eq(sessionThemes.drafting, 'generating'),
                    ),
                )
                .returning({ id: sessionThemes.id });

            if (!claimed) tx.rollback();

            await tx
                .delete(sessionBlockThemes)
                .where(
                    and(
                        eq(sessionBlockThemes.theme, theme),
                        inArray(
                            sessionBlockThemes.blockId,
                            tx
                                .select({ id: sessionBlocks.id })
                                .from(sessionBlocks)
                                .where(
                                    eq(
                                        sessionBlocks.learningSessionId,
                                        sessionId,
                                    ),
                                ),
                        ),
                    ),
                );

            if (rows.length > 0)
                await tx.insert(sessionBlockThemes).values(rows);
        });
    } catch (error) {
        if (error instanceof TransactionRollbackError) return false;
        throw error;
    }

    return true;
}

async function draftTheme(
    app: FastifyInstance,
    sessionId: number,
    rowId: number,
    note: string | null,
) {
    let theme: string | null = null;

    try {
        const config = aiConfig(app.env);

        if (!config)
            throw new AiError('not_configured', 'AI is not configured');

        const context = await themeContext(app.db, sessionId, rowId);

        if (!context) return;

        theme = context.theme;

        const { value, model, outputTokens } = await chatJson(
            config,
            {
                system: THEME_SYSTEM_PROMPT,
                user: themeMessage(
                    context.module,
                    context.theme,
                    context.base,
                    {
                        current: context.current,
                        note,
                    },
                ),
                schema: themeReply,
                check: checkTheme(context.base),
                turns: DRAFT_TURNS,
                cutOff: themeCutOff,
            },
            DRAFT_TIMEOUT_MS,
        );
        const stored = await storeTheme(
            app.db,
            sessionId,
            rowId,
            context.theme,
            context.base,
            value,
            model,
        );

        if (stored) {
            app.log.info(
                {
                    sessionId,
                    theme,
                    prompt: THEME_PROMPT_VERSION,
                    model,
                    outputTokens,
                },
                'session theme drafted',
            );
        }
    } catch (error) {
        const failure = error instanceof AiError ? error.failure : 'internal';

        app.log.warn(
            {
                err: error,
                sessionId,
                theme,
                failure,
                prompt: THEME_PROMPT_VERSION,
            },
            'session theme draft failed',
        );
        await app.db
            .update(sessionThemes)
            .set({ drafting: 'failed', draftError: failure })
            .where(
                and(
                    eq(sessionThemes.id, rowId),
                    eq(sessionThemes.drafting, 'generating'),
                ),
            );
    }
}

const record = z.record(z.string(), z.unknown());

export async function themeStates(db: Queryable, sessionId: number) {
    const rows = await db
        .select({
            theme: sessionThemes.theme,
            drafting: sessionThemes.drafting,
            draftError: sessionThemes.draftError,
            readAt: sessionThemes.readAt,
        })
        .from(sessionThemes)
        .where(eq(sessionThemes.learningSessionId, sessionId));
    const base = (await blocksWithCodes(db, sessionId))
        .filter(({ kind }) => kind !== 'brain_game')
        .map(({ id, kind, content }) => ({
            id,
            parsed: sessionBlock.safeParse({ kind, content }),
        }));
    const stored = await db
        .select({
            blockId: sessionBlockThemes.blockId,
            theme: sessionBlockThemes.theme,
            content: sessionBlockThemes.content,
        })
        .from(sessionBlockThemes)
        .innerJoin(
            sessionBlocks,
            eq(sessionBlocks.id, sessionBlockThemes.blockId),
        )
        .where(eq(sessionBlocks.learningSessionId, sessionId));
    const contents = new Map(
        stored.map(({ blockId, theme, content }) => [
            `${theme}:${blockId}`,
            content,
        ]),
    );
    const order = (theme: string) =>
        (INTERESTS as readonly string[]).indexOf(theme);

    return rows
        .sort((a, b) => order(a.theme) - order(b.theme))
        .map(({ theme, drafting, draftError, readAt }) => {
            const blocks = base.flatMap(({ id }) => {
                const content = record.safeParse(
                    contents.get(`${theme}:${id}`),
                );
                return content.success ? [{ id, content: content.data }] : [];
            });
            const complete = blocks.length === base.length;
            const mismatch =
                drafting === null &&
                (!complete ||
                    base.some(({ id, parsed }) => {
                        if (!parsed.success) return false;
                        const themed = themedContent(
                            parsed.data,
                            contents.get(`${theme}:${id}`),
                        );
                        return (
                            !themed.success ||
                            themeProblems(parsed.data, themed.data).length > 0
                        );
                    }));

            return {
                theme,
                drafting,
                draftError,
                read: readAt !== null,
                readAt,
                mismatch,
                complete,
                blocks,
            };
        });
}

export function startThemeDraft(
    app: FastifyInstance,
    sessionId: number,
    rowId: number,
    note: string | null,
) {
    inBackground(
        app,
        draftTheme(app, sessionId, rowId, note).catch((error) =>
            app.log.error(
                { err: error, sessionId, rowId },
                'session theme draft crashed',
            ),
        ),
    );
}

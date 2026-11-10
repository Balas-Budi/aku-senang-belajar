import { and, inArray } from 'drizzle-orm';
import type { Queryable } from '../db/index.ts';
import { sessionBlockThemes } from '../db/schema.ts';
import { sessionBlock, type SessionBlock, withTheme } from './blocks.ts';

export type ThemePick = { blockId: number; theme: string | null };

export async function themesFor(db: Queryable, picks: ThemePick[]) {
    const wanted = picks.flatMap(({ blockId, theme }) =>
        theme === null ? [] : [{ blockId, theme }],
    );

    if (wanted.length === 0) return new Map<number, unknown>();

    const rows = await db
        .select({
            blockId: sessionBlockThemes.blockId,
            theme: sessionBlockThemes.theme,
            content: sessionBlockThemes.content,
        })
        .from(sessionBlockThemes)
        .where(
            and(
                inArray(
                    sessionBlockThemes.blockId,
                    wanted.map(({ blockId }) => blockId),
                ),
                inArray(sessionBlockThemes.theme, [
                    ...new Set(wanted.map(({ theme }) => theme)),
                ]),
            ),
        );

    return new Map(
        rows
            .filter((row) =>
                wanted.some(
                    ({ blockId, theme }) =>
                        blockId === row.blockId && theme === row.theme,
                ),
            )
            .map((row) => [row.blockId, row.content]),
    );
}

export const themedOr = (base: SessionBlock, themed: unknown) =>
    themed === undefined ? base : withTheme(base, themed);

export const themedBlock = (
    row: { id: number; kind: SessionBlock['kind']; content: unknown },
    themes: Map<number, unknown>,
) =>
    themedOr(
        sessionBlock.parse({ kind: row.kind, content: row.content }),
        themes.get(row.id),
    );

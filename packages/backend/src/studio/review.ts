import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { Queryable } from '../db/index.ts';
import { competencies, materialPages, modules } from '../db/schema.ts';
import { sessionBlock } from '../learning/blocks.ts';
import { competencyRubric } from '../learning/rubric.ts';
import { blocksWithCodes } from './drafting.ts';

export const warningCodes = ['no_page_source', 'unreadable_pages'] as const;

export type Issue =
    | { code: 'no_draft' }
    | {
          code: 'missing_rubric' | 'untested_competency';
          competencies: string[];
      }
    | { code: 'invalid_block'; blocks: number[] };

export type Warning =
    | { code: 'no_page_source'; blocks: number[] }
    | { code: 'unreadable_pages'; pages: number[] };

const sourcedKinds = new Set(['story', 'check', 'challenge']);
const testingKinds = new Set(['check', 'challenge']);

async function unreadablePages(db: Queryable, moduleId: number) {
    const [module] = await db
        .select({
            materialId: modules.materialId,
            firstPage: modules.firstPage,
            lastPage: modules.lastPage,
        })
        .from(modules)
        .where(eq(modules.id, moduleId));

    if (!module || module.firstPage === null || module.lastPage === null) {
        return [];
    }

    const rows = await db
        .select({ number: materialPages.number })
        .from(materialPages)
        .where(
            and(
                eq(materialPages.materialId, module.materialId),
                gte(materialPages.number, module.firstPage),
                lte(materialPages.number, module.lastPage),
                isNull(materialPages.text),
            ),
        )
        .orderBy(asc(materialPages.number));

    return rows.map(({ number }) => number);
}

export async function reviewSession(
    db: Queryable,
    sessionId: number,
    moduleId: number,
): Promise<{ issues: Issue[]; warnings: Warning[] }> {
    const blocks = await blocksWithCodes(db, sessionId);

    if (blocks.length === 0) {
        return { issues: [{ code: 'no_draft' }], warnings: [] };
    }

    const rows = await db
        .select({ code: competencies.code, rubric: competencies.rubric })
        .from(competencies)
        .where(eq(competencies.moduleId, moduleId))
        .orderBy(asc(competencies.id));
    const tested = new Set(
        blocks
            .filter(({ kind }) => testingKinds.has(kind))
            .flatMap((block) => block.competencies),
    );
    const missingRubric = rows
        .filter(({ rubric }) => !competencyRubric.safeParse(rubric).success)
        .map(({ code }) => code);
    const untested = rows
        .filter(({ code }) => !tested.has(code))
        .map(({ code }) => code);
    const invalid = blocks
        .filter(
            ({ kind, content }) =>
                !sessionBlock.safeParse({ kind, content }).success,
        )
        .map(({ position }) => position);
    const unsourced = blocks
        .filter(
            ({ kind, sourcePages }) =>
                sourcedKinds.has(kind) && sourcePages.length === 0,
        )
        .map(({ position }) => position);
    const unreadable = await unreadablePages(db, moduleId);

    const issues: Issue[] = [
        ...(missingRubric.length > 0
            ? [{ code: 'missing_rubric' as const, competencies: missingRubric }]
            : []),
        ...(untested.length > 0
            ? [{ code: 'untested_competency' as const, competencies: untested }]
            : []),
        ...(invalid.length > 0
            ? [{ code: 'invalid_block' as const, blocks: invalid }]
            : []),
    ];
    const warnings: Warning[] = [
        ...(unsourced.length > 0
            ? [{ code: 'no_page_source' as const, blocks: unsourced }]
            : []),
        ...(unreadable.length > 0
            ? [{ code: 'unreadable_pages' as const, pages: unreadable }]
            : []),
    ];

    return { issues, warnings };
}

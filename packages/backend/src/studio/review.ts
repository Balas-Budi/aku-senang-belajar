import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { Queryable } from '../db/index.ts';
import { competencies, materialPages, modules } from '../db/schema.ts';
import {
    diagramsOf,
    numbersIn,
    sessionBlock,
    type SessionBlock,
} from '../learning/blocks.ts';
import { competencyRubric } from '../learning/rubric.ts';
import { pageContent } from '../materials/page-content.ts';
import { blocksWithCodes, sessionCompetencyIds } from './drafting.ts';
import { themeStates } from './theming.ts';

export const warningCodes = [
    'no_page_source',
    'unreadable_pages',
    'ai_diagrams',
    'repeats_example',
] as const;

export type Issue =
    | { code: 'no_draft' }
    | {
          code: 'missing_rubric' | 'untested_competency';
          competencies: string[];
      }
    | { code: 'invalid_block'; blocks: number[] }
    | {
          code:
              | 'theme_drafting'
              | 'theme_failed'
              | 'theme_mismatch'
              | 'theme_unread';
          themes: string[];
      };

type ThemeState = Awaited<ReturnType<typeof themeStates>>[number];

function themeIssues(states: ThemeState[]): Issue[] {
    const rules = [
        ['theme_drafting', ({ drafting }) => drafting === 'generating'],
        ['theme_failed', ({ drafting }) => drafting === 'failed'],
        ['theme_mismatch', ({ mismatch }) => mismatch],
        [
            'theme_unread',
            ({ drafting, mismatch, read }) =>
                drafting === null && !mismatch && !read,
        ],
    ] as const satisfies readonly (readonly [
        Issue['code'],
        (state: ThemeState) => boolean,
    ])[];

    return rules.flatMap(([code, matches]) => {
        const themes = states.filter(matches).map(({ theme }) => theme);
        return themes.length > 0 ? [{ code, themes }] : [];
    });
}

export type Warning =
    | { code: 'no_page_source'; blocks: number[] }
    | { code: 'unreadable_pages'; pages: number[] }
    | { code: 'ai_diagrams'; blocks: number[] }
    | { code: 'repeats_example'; blocks: number[] };

function asked(block: SessionBlock) {
    if (
        block.kind !== 'check' &&
        block.kind !== 'challenge' &&
        block.kind !== 'extra_challenge'
    ) {
        return null;
    }

    const { content } = block;

    if (!content.options) return null;

    const labels = content.options
        .map(({ label }) => label.trim().toLowerCase())
        .sort();
    const numbers = numbersIn([
        content.prompt,
        ...('question' in content ? [content.question] : []),
        ...labels,
    ]);

    return numbers.length > 0 ? JSON.stringify([numbers, labels]) : null;
}

const sourcedKinds = new Set([
    'story',
    'check',
    'challenge',
    'extra_challenge',
]);
const testingKinds = new Set(['check', 'challenge']);

async function unreadablePages(db: Queryable, moduleId: number) {
    const [module] = await db
        .select({
            materialId: modules.materialId,
            version: modules.materialVersion,
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
                eq(materialPages.version, module.version),
                gte(materialPages.number, module.firstPage),
                lte(materialPages.number, module.lastPage),
                isNull(pageContent),
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
        .where(inArray(competencies.id, sessionCompetencyIds(db, sessionId)))
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
    const drawn = blocks
        .filter(({ kind, content }) => {
            const parsed = sessionBlock.safeParse({ kind, content });
            return parsed.success && diagramsOf(parsed.data).length > 0;
        })
        .map(({ position }) => position);
    const questions = blocks.flatMap(({ kind, content, position }) => {
        const parsed = sessionBlock.safeParse({ kind, content });
        const key = parsed.success ? asked(parsed.data) : null;
        return key ? [{ kind, position, key }] : [];
    });
    const checked = new Set(
        questions.filter(({ kind }) => kind === 'check').map(({ key }) => key),
    );
    const repeating = questions
        .filter(({ kind, key }) => kind !== 'check' && checked.has(key))
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
        ...themeIssues(await themeStates(db, sessionId)),
    ];
    const warnings: Warning[] = [
        ...(unsourced.length > 0
            ? [{ code: 'no_page_source' as const, blocks: unsourced }]
            : []),
        ...(unreadable.length > 0
            ? [{ code: 'unreadable_pages' as const, pages: unreadable }]
            : []),
        ...(drawn.length > 0
            ? [{ code: 'ai_diagrams' as const, blocks: drawn }]
            : []),
        ...(repeating.length > 0
            ? [{ code: 'repeats_example' as const, blocks: repeating }]
            : []),
    ];

    return { issues, warnings };
}

import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AiError, aiConfig, chatJson } from '../ai/chat.ts';
import type { Queryable } from '../db/index.ts';
import {
    blockCompetencies,
    competencies,
    learningSessions,
    materialPages,
    materials,
    modules,
    sessionBlocks,
    sessionCompetencies,
} from '../db/schema.ts';
import { diagramsOf } from '../learning/blocks.ts';
import { competencyRubric } from '../learning/rubric.ts';
import { inBackground } from '../lib/background.ts';
import {
    checkDraft,
    SESSION_PROMPT_VERSION,
    SESSION_SYSTEM_PROMPT,
    sessionDraft,
    sessionMessage,
    storedBlocks,
    type SessionDraft,
} from './session-draft.ts';

const DRAFT_TIMEOUT_MS = 180_000;
const DRAFT_TURNS = 3;
const contentOf = z.record(z.string(), z.unknown());

export function sessionCompetencyIds(db: Queryable, sessionId: number) {
    return db
        .select({ id: sessionCompetencies.competencyId })
        .from(sessionCompetencies)
        .where(eq(sessionCompetencies.learningSessionId, sessionId));
}

export async function blocksWithCodes(db: Queryable, sessionId: number) {
    const rows = await db
        .select({
            id: sessionBlocks.id,
            position: sessionBlocks.position,
            kind: sessionBlocks.kind,
            content: sessionBlocks.content,
            sourcePages: sessionBlocks.sourcePages,
            competencies: sql<
                string[]
            >`coalesce(array_agg(${competencies.code} order by ${competencies.code}) filter (where ${competencies.code} is not null), '{}')`,
        })
        .from(sessionBlocks)
        .leftJoin(
            blockCompetencies,
            eq(blockCompetencies.blockId, sessionBlocks.id),
        )
        .leftJoin(
            competencies,
            eq(competencies.id, blockCompetencies.competencyId),
        )
        .where(eq(sessionBlocks.learningSessionId, sessionId))
        .groupBy(sessionBlocks.id)
        .orderBy(asc(sessionBlocks.position));

    return rows.map((row) => ({
        ...row,
        content: contentOf.parse(row.content),
    }));
}

async function draftContext(db: Queryable, sessionId: number) {
    const [session] = await db
        .select({
            title: learningSessions.title,
            summary: learningSessions.summary,
            moduleId: modules.id,
            moduleTitle: modules.title,
            firstPage: modules.firstPage,
            lastPage: modules.lastPage,
            materialId: materials.id,
            subject: materials.subject,
            grade: materials.grade,
        })
        .from(learningSessions)
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(eq(learningSessions.id, sessionId));

    if (!session) throw new Error(`Session ${sessionId} has no module`);

    const missionCompetencies = await db
        .select({
            id: competencies.id,
            code: competencies.code,
            description: competencies.description,
            rubric: competencies.rubric,
        })
        .from(competencies)
        .where(inArray(competencies.id, sessionCompetencyIds(db, sessionId)))
        .orderBy(asc(competencies.id));
    const pages =
        session.firstPage === null || session.lastPage === null
            ? []
            : await db
                  .select({
                      number: materialPages.number,
                      text: materialPages.text,
                  })
                  .from(materialPages)
                  .where(
                      and(
                          eq(materialPages.materialId, session.materialId),
                          gte(materialPages.number, session.firstPage),
                          lte(materialPages.number, session.lastPage),
                          isNotNull(materialPages.text),
                      ),
                  )
                  .orderBy(asc(materialPages.number));
    const blocks = await blocksWithCodes(db, sessionId);

    return {
        session,
        competencies: missionCompetencies.map((competency) => ({
            ...competency,
            rubric:
                competency.rubric === null
                    ? null
                    : competencyRubric.parse(competency.rubric),
        })),
        pages: pages.flatMap(({ number, text }) =>
            text === null ? [] : [{ number, text }],
        ),
        current:
            blocks.length === 0
                ? null
                : {
                      title: session.title,
                      summary: session.summary,
                      blocks: blocks
                          .filter(({ kind }) => kind !== 'brain_game')
                          .map((block) => ({
                              screen: block.position,
                              kind: block.kind,
                              content: block.content,
                              competencies: block.competencies,
                              pages: block.sourcePages,
                          })),
                  },
    };
}

async function storeDraft(
    db: Queryable,
    sessionId: number,
    draft: SessionDraft,
    competencyIds: Map<string, number>,
) {
    await db.transaction(async (tx) => {
        await tx
            .delete(sessionBlocks)
            .where(eq(sessionBlocks.learningSessionId, sessionId));

        for (const [index, { block, codes, pages }] of storedBlocks(
            draft,
        ).entries()) {
            const [row] = await tx
                .insert(sessionBlocks)
                .values({
                    learningSessionId: sessionId,
                    position: index + 1,
                    kind: block.kind,
                    content: block.content,
                    sourcePages: pages,
                })
                .returning({ id: sessionBlocks.id });
            const links = codes.flatMap((code) => {
                const competencyId = competencyIds.get(code);
                return competencyId === undefined
                    ? []
                    : [{ blockId: row.id, competencyId }];
            });

            if (links.length > 0) {
                await tx.insert(blockCompetencies).values(links);
            }
        }

        await tx
            .update(learningSessions)
            .set({
                title: draft.title,
                summary: draft.summary,
                version: sql`${learningSessions.version} + 1`,
                drafting: null,
                draftError: null,
            })
            .where(eq(learningSessions.id, sessionId));
    });
}

async function draftSession(
    app: FastifyInstance,
    sessionId: number,
    note: string | null,
) {
    try {
        const config = aiConfig(app.env);

        if (!config)
            throw new AiError('not_configured', 'AI is not configured');

        const context = await draftContext(app.db, sessionId);
        const { value, model, outputTokens } = await chatJson(
            config,
            {
                system: SESSION_SYSTEM_PROMPT,
                user: sessionMessage(
                    {
                        title: context.session.moduleTitle,
                        subject: context.session.subject,
                        grade: context.session.grade,
                    },
                    context.competencies,
                    context.pages,
                    context.current && { draft: context.current, note },
                ),
                schema: sessionDraft,
                check: checkDraft(
                    context.competencies.map(({ code }) => code),
                    context.pages.map(({ number }) => number),
                ),
                turns: DRAFT_TURNS,
                cutOff: context.current
                    ? 'Your reply was cut off because it was too long. Reply again with the whole JSON object, without indentation: keep every diagram the teacher did not ask to change exactly as it is in the current draft, and make the screen texts shorter instead.'
                    : 'Your reply was cut off because it was too long. Reply again with the whole JSON object, without indentation, with at most 5 diagrams of at most 12 shapes each.',
            },
            DRAFT_TIMEOUT_MS,
        );

        await storeDraft(
            app.db,
            sessionId,
            value,
            new Map(context.competencies.map(({ code, id }) => [code, id])),
        );

        const places = storedBlocks(value).flatMap(({ block }) =>
            diagramsOf(block),
        );

        app.log.info(
            {
                sessionId,
                prompt: SESSION_PROMPT_VERSION,
                model,
                outputTokens,
                diagrams: places.length,
                shapes: places.reduce(
                    (total, { diagram }) => total + diagram.shapes.length,
                    0,
                ),
            },
            'session drafted',
        );
    } catch (error) {
        const failure = error instanceof AiError ? error.failure : 'internal';

        app.log.warn(
            { err: error, sessionId, failure, prompt: SESSION_PROMPT_VERSION },
            'session draft failed',
        );
        await app.db
            .update(learningSessions)
            .set({ drafting: 'failed', draftError: failure })
            .where(eq(learningSessions.id, sessionId));
    }
}

export function startDraft(
    app: FastifyInstance,
    sessionId: number,
    note: string | null,
) {
    inBackground(
        app,
        draftSession(app, sessionId, note).catch((error) =>
            app.log.error({ err: error, sessionId }, 'session draft crashed'),
        ),
    );
}

export async function failInterruptedDrafts(db: Queryable) {
    // shortcut: drafts run in memory, so a restart fails the ones in hand; move them to a queued runner like analysis_runs when drafting must survive restarts or run on several instances
    await db
        .update(learningSessions)
        .set({ drafting: 'failed', draftError: 'interrupted' })
        .where(eq(learningSessions.drafting, 'generating'));
}

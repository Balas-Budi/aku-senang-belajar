import { and, asc, eq, lt, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { type AiConfig, aiConfig, AiError, chatJson } from '../ai/chat.ts';
import type { Queryable } from '../db/index.ts';
import {
    analysisRuns,
    assessments,
    attempts,
    learnerSummaries,
} from '../db/schema.ts';
import { runNextAdaptation } from '../memory/adaptations.ts';
import { runNextSummary } from '../memory/summaries.ts';
import { type CompetencyEvidence, evidenceOf } from './evidence.ts';
import {
    checkAnswer,
    modelAnswer,
    PROMPT_VERSION,
    SYSTEM_PROMPT,
    userMessage,
} from './prompt.ts';

const MAX_TRIES = 3;
const MODEL_TIMEOUT = 120_000;
const STALE_AFTER = 5 * 60_000;

type Assessment = Omit<
    typeof assessments.$inferInsert,
    'id' | 'runId' | 'createdAt'
>;

export type ClaimedRun = { id: number; attemptId: number; tries: number };

export async function queueAnalysis(db: Queryable, attemptId: number) {
    await db.insert(analysisRuns).values({ attemptId });
}

function withoutAnswers(competency: CompetencyEvidence): Assessment {
    return {
        competencyId: competency.id,
        status: 'not_observed',
        reason: competency.selfReport
            ? 'Hanya ada refleksi siswa; belum ada jawaban soal untuk kompetensi ini.'
            : 'Belum ada jawaban soal untuk kompetensi ini.',
        uncertainty: 'high',
        flags: ['thin'],
        evidence: [],
        followUps: [],
    };
}

export async function analyse(
    db: Queryable,
    attemptId: number,
    ai: AiConfig | null,
) {
    const evidence = await evidenceOf(db, attemptId);
    const judged = evidence.filter(({ questions }) => questions.length > 0);
    const unseen = evidence
        .filter(({ questions }) => questions.length === 0)
        .map(withoutAnswers);

    if (judged.length === 0) {
        return { assessments: unseen, model: null };
    }

    if (!ai) {
        throw new AiError(
            'not_configured',
            'AI_BASE_URL, AI_API_KEY, and AI_MODEL are not all set',
        );
    }

    const reply = await chatJson(
        ai,
        {
            system: SYSTEM_PROMPT,
            user: userMessage(judged),
            schema: modelAnswer,
            check: checkAnswer(judged),
        },
        MODEL_TIMEOUT,
    );
    const entries = new Map(
        reply.value.competencies.map((entry) => [entry.code, entry]),
    );
    const judgedByModel = judged.map((competency): Assessment => {
        const entry = entries.get(competency.code);

        if (!entry) {
            throw new Error(`The model answer lost ${competency.code}`);
        }

        return {
            competencyId: competency.id,
            status: entry.status,
            reason: entry.reason,
            uncertainty:
                competency.questions.length === 1 && entry.uncertainty === 'low'
                    ? 'medium'
                    : entry.uncertainty,
            flags: entry.flags,
            evidence: entry.evidence,
            followUps: entry.followUps,
        };
    });

    return { assessments: [...unseen, ...judgedByModel], model: reply.model };
}

export async function claimRun(
    db: Queryable,
    { attemptId }: { attemptId?: number } = {},
): Promise<ClaimedRun | null> {
    const now = new Date();

    await db
        .update(analysisRuns)
        .set({ status: 'queued', runAfter: now })
        .where(
            and(
                eq(analysisRuns.status, 'running'),
                lt(
                    analysisRuns.startedAt,
                    new Date(now.getTime() - STALE_AFTER),
                ),
            ),
        );

    return db.transaction(async (tx) => {
        const [run] = await tx
            .select({
                id: analysisRuns.id,
                attemptId: analysisRuns.attemptId,
                tries: analysisRuns.tries,
            })
            .from(analysisRuns)
            .where(
                and(
                    eq(analysisRuns.status, 'queued'),
                    lte(analysisRuns.runAfter, now),
                    attemptId === undefined
                        ? undefined
                        : eq(analysisRuns.attemptId, attemptId),
                ),
            )
            .orderBy(asc(analysisRuns.runAfter), asc(analysisRuns.id))
            .limit(1)
            .for('update', { skipLocked: true });

        if (!run) {
            return null;
        }

        await tx
            .update(analysisRuns)
            .set({ status: 'running', tries: run.tries + 1, startedAt: now })
            .where(eq(analysisRuns.id, run.id));

        return { ...run, tries: run.tries + 1 };
    });
}

export async function processRun(
    app: FastifyInstance,
    run: ClaimedRun,
    ai: AiConfig | null,
) {
    try {
        const result = await analyse(app.db, run.attemptId, ai);

        await app.db.transaction(async (tx) => {
            if (result.assessments.length > 0) {
                await tx.insert(assessments).values(
                    result.assessments.map((assessment) => ({
                        ...assessment,
                        runId: run.id,
                    })),
                );
            }

            await tx
                .update(analysisRuns)
                .set({
                    status: 'succeeded',
                    model: result.model,
                    promptVersion: PROMPT_VERSION,
                    error: null,
                    finishedAt: new Date(),
                })
                .where(eq(analysisRuns.id, run.id));

            if (result.model) {
                const [attempt] = await tx
                    .select({ memoryDeletedAt: attempts.memoryDeletedAt })
                    .from(attempts)
                    .where(eq(attempts.id, run.attemptId))
                    .for('share');

                if (attempt?.memoryDeletedAt === null) {
                    await tx.insert(learnerSummaries).values({ runId: run.id });
                }
            }
        });
    } catch (error) {
        const failure = error instanceof AiError ? error.failure : 'error';
        const message =
            error instanceof Error ? error.message : 'Unknown error';
        const delay = run.tries === 1 ? 60_000 : 5 * 60_000;

        await app.db
            .update(analysisRuns)
            .set(
                run.tries >= MAX_TRIES
                    ? {
                          status: 'failed',
                          error: message,
                          finishedAt: new Date(),
                      }
                    : {
                          status: 'queued',
                          error: message,
                          runAfter: new Date(Date.now() + delay),
                      },
            )
            .where(eq(analysisRuns.id, run.id));
        app.log.warn(
            {
                runId: run.id,
                attemptId: run.attemptId,
                tries: run.tries,
                failure,
            },
            'An analysis run failed',
        );
    }
}

export async function runNextAnalysis(
    app: FastifyInstance,
    only: { attemptId?: number } = {},
) {
    const run = await claimRun(app.db, only);

    if (!run) {
        return false;
    }

    await processRun(app, run, aiConfig(app.env));

    return true;
}

export function startAnalysisRunner(
    app: FastifyInstance,
    {
        everyMs = 5_000,
        attemptId,
    }: { everyMs?: number; attemptId?: number } = {},
) {
    let timer: NodeJS.Timeout | undefined;
    let draining: Promise<void> | null = null;
    let closing = false;

    async function drain() {
        try {
            for (let more = true; more && !closing;) {
                more =
                    (await runNextAnalysis(app, { attemptId })) ||
                    (await runNextSummary(app, { attemptId })) ||
                    (await runNextAdaptation(app, { attemptId }));
            }
        } catch (error) {
            app.log.error(error, 'The analysis runner stopped a round');
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

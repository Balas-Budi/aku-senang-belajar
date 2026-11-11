import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import {
    analysisRuns,
    assessments,
    blockCompetencies,
    competencies,
    reviewTries,
    sessionBlocks,
    type subject,
    type understandingStatus,
} from '../../db/schema.ts';
import { themedBlock, themesFor } from '../../learning/themed-blocks.ts';
import { notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { keptSummaries, namesCode } from '../../memory/adaptations.ts';
import { currentRuns, decisionsOn, shownOf } from '../results/queries.ts';
import { earnedOf, followUp, judge, placedRight } from './attempts.ts';
import { missionsOf } from './missions.ts';
import { answer as storedAnswer, type Answer } from './schema.ts';

type Subject = (typeof subject.enumValues)[number];
type UnderstandingStatus = (typeof understandingStatus.enumValues)[number];
type Try = typeof reviewTries.$inferSelect;

const REVIEW_SIZE = 3;

const themeOf = (
    missions: { sessionId: number; theme: string | null }[],
    sessionId: number,
) => missions.find((mission) => mission.sessionId === sessionId)?.theme ?? null;

export async function shownStatuses(
    db: Queryable,
    attemptIds: number[],
): Promise<Map<number, UnderstandingStatus>> {
    const finished = [...(await currentRuns(db, attemptIds)).values()]
        .filter(({ status }) => status === 'succeeded')
        .map(({ id }) => id);
    const newest = new Map<number, UnderstandingStatus>();

    if (finished.length === 0) return newest;

    const estimates = await db
        .select({
            id: assessments.id,
            competencyId: assessments.competencyId,
            status: assessments.status,
            attemptId: analysisRuns.attemptId,
        })
        .from(assessments)
        .innerJoin(analysisRuns, eq(analysisRuns.id, assessments.runId))
        .where(inArray(assessments.runId, finished));
    const decisions = await decisionsOn(
        db,
        estimates.map(({ id }) => id),
    );

    for (const attemptId of attemptIds) {
        for (const estimate of estimates.filter(
            (row) => row.attemptId === attemptId,
        )) {
            if (newest.has(estimate.competencyId)) continue;
            newest.set(
                estimate.competencyId,
                shownOf(
                    estimate.status,
                    decisions.filter(
                        ({ assessmentId }) => assessmentId === estimate.id,
                    ),
                ).status,
            );
        }
    }

    return newest;
}

export async function lockTries(
    tx: Queryable,
    studentId: number,
    blockId: number,
) {
    await tx.execute(
        sql`select pg_advisory_xact_lock(${studentId}::int, ${blockId}::int)`,
    );
}

export function triesOf(db: Queryable, studentId: number, blockIds: number[]) {
    return blockIds.length === 0
        ? Promise.resolve([] as Try[])
        : db
              .select()
              .from(reviewTries)
              .where(
                  and(
                      eq(reviewTries.studentId, studentId),
                      inArray(reviewTries.blockId, blockIds),
                  ),
              )
              .orderBy(asc(reviewTries.id));
}

export function roundOf(tries: Try[]) {
    const ended = tries.reduce(
        (last, item, index) =>
            item.outcome === 'correct' || item.help === 'reveal' ? index : last,
        -1,
    );

    return tries.slice(ended + 1).map((item) => ({
        blockId: item.blockId,
        tryNumber: item.tryNumber,
        answer: storedAnswer.parse(item.answer),
        outcome: item.outcome,
        help: item.help,
    }));
}

export function practiceHistoryOf(round: ReturnType<typeof roundOf>) {
    return {
        answers: round.map(({ blockId, tryNumber, answer, outcome }) => ({
            blockId,
            tryNumber,
            answer,
            outcome,
        })),
        help: round.flatMap(({ help }) => (help ? [help] : [])),
    };
}

export async function reviewOf(
    db: Queryable,
    studentId: number,
    only: Subject,
) {
    const missions = await missionsOf(db, studentId, only);
    const weak = [
        ...(
            await shownStatuses(
                db,
                missions.map(({ attemptId }) => attemptId),
            )
        ).entries(),
    ]
        .filter(
            ([, status]) =>
                status === 'developing' || status === 'needs_verification',
        )
        .map(([competencyId]) => competencyId);

    if (weak.length === 0) return { questions: [] };

    const linked = await db
        .select({
            id: sessionBlocks.id,
            sessionId: sessionBlocks.learningSessionId,
            position: sessionBlocks.position,
            kind: sessionBlocks.kind,
            content: sessionBlocks.content,
            code: competencies.code,
            moduleId: competencies.moduleId,
        })
        .from(sessionBlocks)
        .innerJoin(
            blockCompetencies,
            eq(blockCompetencies.blockId, sessionBlocks.id),
        )
        .innerJoin(
            competencies,
            eq(competencies.id, blockCompetencies.competencyId),
        )
        .where(
            and(
                eq(sessionBlocks.kind, 'check'),
                inArray(
                    sessionBlocks.learningSessionId,
                    missions.map(({ sessionId }) => sessionId),
                ),
                inArray(blockCompetencies.competencyId, weak),
            ),
        );
    const rows = [
        ...new Map(
            linked.map(({ code: _, moduleId: _module, ...row }) => [
                row.id,
                row,
            ]),
        ).values(),
    ];
    const notes = (await keptSummaries(db, studentId, only, missions)).slice(
        0,
        5,
    );
    const memoryRank = (blockId: number) =>
        Math.min(
            notes.length,
            ...linked
                .filter(({ id }) => id === blockId)
                .map(({ code, moduleId }) =>
                    notes.findIndex(
                        (note) =>
                            missions.find(
                                ({ attemptId }) => attemptId === note.attemptId,
                            )?.moduleId === moduleId &&
                            namesCode(note.text, code),
                    ),
                )
                .filter((index) => index !== -1),
        );
    const tries = await triesOf(
        db,
        studentId,
        rows.map(({ id }) => id),
    );
    const order = (sessionId: number) =>
        missions.findIndex((mission) => mission.sessionId === sessionId);
    const mastered = (blockId: number) =>
        tries.some(
            (item) => item.blockId === blockId && item.outcome === 'correct',
        );
    const chosen = [...rows]
        .sort(
            (one, other) =>
                Number(mastered(one.id)) - Number(mastered(other.id)) ||
                memoryRank(one.id) - memoryRank(other.id) ||
                order(one.sessionId) - order(other.sessionId) ||
                one.position - other.position,
        )
        .slice(0, REVIEW_SIZE);
    const themes = await themesFor(
        db,
        chosen.map((row) => ({
            blockId: row.id,
            theme: themeOf(missions, row.sessionId),
        })),
    );

    return {
        questions: chosen.flatMap((row) => {
            const block = themedBlock(row, themes);
            const round = roundOf(
                tries.filter(({ blockId }) => blockId === row.id),
            );

            return block.kind === 'check'
                ? [
                      {
                          id: row.id,
                          mission:
                              missions.find(
                                  ({ sessionId }) =>
                                      sessionId === row.sessionId,
                              )?.title ?? '',
                          content: block.content,
                          earned: earnedOf(
                              { ...block, id: row.id, position: row.position },
                              practiceHistoryOf(round),
                          ),
                          tries: round.length,
                      },
                  ]
                : [];
        }),
    };
}

export async function answerReview(
    db: Queryable,
    studentId: number,
    given: { blockId: number; tryNumber: number; answer: Answer },
) {
    const missions = await missionsOf(db, studentId);
    const [row] =
        missions.length === 0
            ? []
            : await db
                  .select({
                      id: sessionBlocks.id,
                      sessionId: sessionBlocks.learningSessionId,
                      position: sessionBlocks.position,
                      kind: sessionBlocks.kind,
                      content: sessionBlocks.content,
                  })
                  .from(sessionBlocks)
                  .where(
                      and(
                          eq(sessionBlocks.id, given.blockId),
                          eq(sessionBlocks.kind, 'check'),
                          inArray(
                              sessionBlocks.learningSessionId,
                              missions.map(({ sessionId }) => sessionId),
                          ),
                      ),
                  );

    if (!row) {
        throw notFound('Question not found');
    }

    const block = {
        id: row.id,
        position: row.position,
        ...themedBlock(
            row,
            await themesFor(db, [
                { blockId: row.id, theme: themeOf(missions, row.sessionId) },
            ]),
        ),
    };

    if (block.kind !== 'check') {
        throw notFound('Question not found');
    }

    const history = practiceHistoryOf(
        roundOf(await triesOf(db, studentId, [block.id])),
    );

    if (given.tryNumber !== history.answers.length + 1) {
        throw fieldError(
            'tryNumber',
            `The next try is number ${history.answers.length + 1}`,
        );
    }

    const outcome = judge(block, given.answer);
    const help = followUp(block, history, given.tryNumber, outcome);

    await db.insert(reviewTries).values({
        studentId,
        blockId: block.id,
        tryNumber: given.tryNumber,
        answer: given.answer,
        outcome,
        help,
    });

    return {
        outcome,
        inPlace: placedRight(block, given.answer, outcome),
        earned: earnedOf(block, {
            answers: [
                ...history.answers,
                {
                    blockId: block.id,
                    tryNumber: given.tryNumber,
                    answer: given.answer,
                    outcome,
                },
            ],
            help: help ? [...history.help, help] : history.help,
        }),
    };
}

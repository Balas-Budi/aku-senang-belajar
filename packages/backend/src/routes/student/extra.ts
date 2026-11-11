import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import {
    learningSessions,
    materials,
    modules,
    reviewTries,
    sessionBlocks,
    sessionCompetencies,
    type subject,
} from '../../db/schema.ts';
import type { SessionBlock } from '../../learning/blocks.ts';
import { themedBlock, themesFor } from '../../learning/themed-blocks.ts';
import { notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { currentRuns } from '../results/queries.ts';
import { earnedOf, followUp, judge } from './attempts.ts';
import { missionsOf } from './missions.ts';
import {
    practiceHistoryOf,
    roundOf,
    shownStatuses,
    triesOf,
} from './review.ts';
import type { Answer } from './schema.ts';

type Subject = (typeof subject.enumValues)[number];
type ExtraBlock = Extract<SessionBlock, { kind: 'extra_challenge' }>;

const asCheck = (block: ExtraBlock) => ({
    ...block,
    kind: 'check' as const,
});

async function waitingExtra(db: Queryable, studentId: number, only: Subject) {
    const missions = await missionsOf(db, studentId, only);
    const rows =
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
                          eq(sessionBlocks.kind, 'extra_challenge'),
                          inArray(
                              sessionBlocks.learningSessionId,
                              missions.map(({ sessionId }) => sessionId),
                          ),
                      ),
                  )
                  .orderBy(asc(sessionBlocks.id));

    if (rows.length === 0) return null;

    const attemptIds = missions.map(({ attemptId }) => attemptId);
    const runs = await currentRuns(db, attemptIds);
    const statuses = await shownStatuses(db, attemptIds);
    const taught = await db
        .select({
            sessionId: sessionCompetencies.learningSessionId,
            competencyId: sessionCompetencies.competencyId,
        })
        .from(sessionCompetencies)
        .where(
            inArray(
                sessionCompetencies.learningSessionId,
                rows.map(({ sessionId }) => sessionId),
            ),
        );
    const tries = await triesOf(
        db,
        studentId,
        rows.map(({ id }) => id),
    );

    for (const mission of missions) {
        const row = rows.find(
            ({ sessionId }) => sessionId === mission.sessionId,
        );

        if (!row || runs.get(mission.attemptId)?.status !== 'succeeded') {
            continue;
        }

        const competencyIds = taught
            .filter(({ sessionId }) => sessionId === row.sessionId)
            .map(({ competencyId }) => competencyId);
        const own = tries.filter(({ blockId }) => blockId === row.id);

        if (
            competencyIds.length === 0 ||
            competencyIds.some((id) => statuses.get(id) !== 'visible') ||
            own.some(
                (item) => item.outcome === 'correct' || item.help === 'reveal',
            )
        ) {
            continue;
        }

        const block = themedBlock(
            row,
            await themesFor(db, [{ blockId: row.id, theme: mission.theme }]),
        );

        if (block.kind !== 'extra_challenge') continue;

        return {
            mission: mission.title,
            block: { ...asCheck(block), id: row.id, position: row.position },
            round: roundOf(own),
        };
    }

    return null;
}

export async function extraOf(db: Queryable, studentId: number, only: Subject) {
    const waiting = await waitingExtra(db, studentId, only);

    return {
        extra: waiting && {
            id: waiting.block.id,
            mission: waiting.mission,
            content: waiting.block.content,
            earned: earnedOf(waiting.block, practiceHistoryOf(waiting.round)),
            tries: waiting.round.length,
        },
    };
}

export async function answerExtra(
    db: Queryable,
    studentId: number,
    given: { blockId: number; tryNumber: number; answer: Answer },
) {
    const [found] = await db
        .select({ subject: materials.subject })
        .from(sessionBlocks)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, sessionBlocks.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(sessionBlocks.id, given.blockId),
                eq(sessionBlocks.kind, 'extra_challenge'),
            ),
        );
    const waiting = found
        ? await waitingExtra(db, studentId, found.subject)
        : null;

    if (!waiting || waiting.block.id !== given.blockId) {
        throw notFound('Question not found');
    }

    const { block } = waiting;
    const history = practiceHistoryOf(waiting.round);

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

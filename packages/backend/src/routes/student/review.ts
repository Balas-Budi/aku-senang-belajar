import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import {
    analysisRuns,
    assessments,
    assignments,
    attempts,
    blockCompetencies,
    classMembers,
    learningSessions,
    materials,
    modules,
    reviewTries,
    sessionBlocks,
    type subject,
} from '../../db/schema.ts';
import { sessionBlock } from '../../learning/blocks.ts';
import { notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { currentRuns, decisionsOn, shownOf } from '../results/queries.ts';
import { earnedOf, followUp, judge } from './attempts.ts';
import { answer as storedAnswer, type Answer } from './schema.ts';

type Subject = (typeof subject.enumValues)[number];
type Try = typeof reviewTries.$inferSelect;

const REVIEW_SIZE = 3;

function missionsOf(db: Queryable, studentId: number, only?: Subject) {
    return db
        .select({
            attemptId: attempts.id,
            sessionId: learningSessions.id,
            title: learningSessions.title,
        })
        .from(attempts)
        .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
        .innerJoin(
            classMembers,
            and(
                eq(classMembers.classId, assignments.classId),
                eq(classMembers.studentId, attempts.studentId),
            ),
        )
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(attempts.studentId, studentId),
                eq(attempts.status, 'submitted'),
                only === undefined ? undefined : eq(materials.subject, only),
            ),
        )
        .orderBy(desc(attempts.submittedAt), desc(attempts.id));
}

async function weakCompetencies(db: Queryable, attemptIds: number[]) {
    const finished = [...(await currentRuns(db, attemptIds)).values()]
        .filter(({ status }) => status === 'succeeded')
        .map(({ id }) => id);

    if (finished.length === 0) return [];

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
    const newest = new Map<number, string>();

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

    return [...newest]
        .filter(
            ([, status]) =>
                status === 'developing' || status === 'needs_verification',
        )
        .map(([competencyId]) => competencyId);
}

function triesOf(db: Queryable, studentId: number, blockIds: number[]) {
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

function roundOf(tries: Try[]) {
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

function historyOf(round: ReturnType<typeof roundOf>) {
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
    const weak = await weakCompetencies(
        db,
        missions.map(({ attemptId }) => attemptId),
    );

    if (weak.length === 0) return { questions: [] };

    const rows = await db
        .selectDistinct({
            id: sessionBlocks.id,
            sessionId: sessionBlocks.learningSessionId,
            position: sessionBlocks.position,
            kind: sessionBlocks.kind,
            content: sessionBlocks.content,
        })
        .from(sessionBlocks)
        .innerJoin(
            blockCompetencies,
            eq(blockCompetencies.blockId, sessionBlocks.id),
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
                order(one.sessionId) - order(other.sessionId) ||
                one.position - other.position,
        )
        .slice(0, REVIEW_SIZE);

    return {
        questions: chosen.flatMap((row) => {
            const block = sessionBlock.parse({
                kind: row.kind,
                content: row.content,
            });
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
                              historyOf(round),
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
        ...sessionBlock.parse({ kind: row.kind, content: row.content }),
    };

    if (block.kind !== 'check') {
        throw notFound('Question not found');
    }

    const history = historyOf(
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

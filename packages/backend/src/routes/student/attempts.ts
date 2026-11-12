import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    attempts,
    classMembers,
    helpEvents,
    learningSessions,
    materials,
    modules,
    responses,
    sessionBlocks,
    type Adaptation,
} from '../../db/schema.ts';
import { adaptationPair } from '../../learning/adaptation.ts';
import {
    answerProblem,
    inPlace,
    isMissionKind,
    type MissionKind,
    type SessionBlock,
} from '../../learning/blocks.ts';
import { liveOf } from '../../learning/live.ts';
import { themedBlock, themesFor } from '../../learning/themed-blocks.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { answer, type Answer, TRY_LIMIT } from './schema.ts';

type Outcome = typeof responses.$inferSelect.outcome;
type HelpKind = typeof helpEvents.$inferSelect.kind;
type Block = SessionBlock & { id: number; position: number };
export type MissionBlock = Block & { kind: MissionKind };
type CheckBlock = Extract<Block, { kind: 'check' }>;
type Saved = {
    blockId: number;
    tryNumber: number;
    answer: Answer;
    outcome: Outcome;
};
type History = {
    answers: Saved[];
    help: { blockId: number; kind: HelpKind }[];
};
type BlockHistory = { answers: Saved[]; help: HelpKind[] };

export const alreadyAnswered = () =>
    new AppError(409, {
        message: 'This block takes no more answers',
        code: 'ALREADY_ANSWERED',
    });

export async function assignmentFor(
    db: Queryable,
    studentId: number,
    assignmentId: number,
) {
    const [found] = await db
        .select({
            id: assignments.id,
            sessionId: learningSessions.id,
            title: learningSessions.title,
            summary: learningSessions.summary,
            subject: materials.subject,
            moduleId: modules.id,
            moduleTitle: modules.title,
            classId: assignments.classId,
            readAloud: learningSessions.readAloud,
            inactiveAt: classMembers.inactiveAt,
        })
        .from(assignments)
        .innerJoin(classMembers, eq(classMembers.classId, assignments.classId))
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(assignments.id, assignmentId),
                eq(classMembers.studentId, studentId),
                eq(learningSessions.status, 'ready'),
            ),
        );

    if (!found) {
        throw notFound('Assignment not found');
    }

    const { inactiveAt, ...assignment } = found;

    if (inactiveAt !== null) {
        throw new AppError(403, {
            message: 'The class membership is inactive',
            code: 'MEMBERSHIP_INACTIVE',
        });
    }

    return assignment;
}

export async function lockedAttempt(
    tx: Queryable,
    studentId: number,
    attemptId: number,
) {
    const [attempt] = await tx
        .select({
            id: attempts.id,
            status: attempts.status,
            theme: attempts.theme,
            adaptation: attempts.adaptation,
            assignmentId: attempts.assignmentId,
            sessionId: assignments.learningSessionId,
        })
        .from(attempts)
        .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
        .innerJoin(
            classMembers,
            and(
                eq(classMembers.classId, assignments.classId),
                eq(classMembers.studentId, attempts.studentId),
                isNull(classMembers.inactiveAt),
            ),
        )
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .where(
            and(
                eq(attempts.id, attemptId),
                eq(attempts.studentId, studentId),
                eq(learningSessions.status, 'ready'),
            ),
        )
        .for('update', { of: attempts });

    if (!attempt) {
        throw notFound('Attempt not found');
    }

    return attempt;
}

export async function openAttempt(
    tx: Queryable,
    studentId: number,
    attemptId: number,
) {
    const attempt = await lockedAttempt(tx, studentId, attemptId);

    if (attempt.status === 'submitted') {
        throw new AppError(409, {
            message: 'The session is already finished',
            code: 'ALREADY_SUBMITTED',
        });
    }

    const live = await liveOf(tx, attempt.assignmentId);

    if (live?.state === 'paused') {
        throw new AppError(409, {
            message: 'The teacher paused the session',
            code: 'LIVE_PAUSED',
        });
    }

    return { ...attempt, live };
}

const blockColumns = {
    id: sessionBlocks.id,
    position: sessionBlocks.position,
    kind: sessionBlocks.kind,
    content: sessionBlocks.content,
};

async function themed(
    db: Queryable,
    theme: string | null,
    rows: {
        id: number;
        position: number;
        kind: Block['kind'];
        content: unknown;
    }[],
): Promise<Block[]> {
    const themes = await themesFor(
        db,
        rows.map(({ id }) => ({ blockId: id, theme })),
    );

    return rows.map((row) => ({
        id: row.id,
        position: row.position,
        ...themedBlock(row, themes),
    }));
}

export async function blocksOf(
    db: Queryable,
    sessionId: number,
    theme: string | null,
) {
    const rows = await db
        .select(blockColumns)
        .from(sessionBlocks)
        .where(
            and(
                eq(sessionBlocks.learningSessionId, sessionId),
                ne(sessionBlocks.kind, 'extra_challenge'),
            ),
        )
        .orderBy(asc(sessionBlocks.position));

    return (await themed(db, theme, rows)).filter(
        (block): block is MissionBlock => isMissionKind(block.kind),
    );
}

export async function blockOf(
    db: Queryable,
    sessionId: number,
    blockId: number,
    theme: string | null,
) {
    const [row] = await db
        .select(blockColumns)
        .from(sessionBlocks)
        .where(
            and(
                eq(sessionBlocks.id, blockId),
                eq(sessionBlocks.learningSessionId, sessionId),
                ne(sessionBlocks.kind, 'extra_challenge'),
            ),
        );

    if (!row) {
        throw fieldError('blockId', 'The block is not part of this session');
    }

    const [block] = await themed(db, theme, [row]);

    return block;
}

export async function historyOf(
    db: Queryable,
    attemptId: number,
): Promise<History> {
    const saved = await db
        .select({
            blockId: responses.blockId,
            tryNumber: responses.tryNumber,
            answer: responses.answer,
            outcome: responses.outcome,
        })
        .from(responses)
        .where(eq(responses.attemptId, attemptId))
        .orderBy(asc(responses.id));
    const help = await db
        .select({ blockId: helpEvents.blockId, kind: helpEvents.kind })
        .from(helpEvents)
        .where(eq(helpEvents.attemptId, attemptId))
        .orderBy(asc(helpEvents.id));

    return {
        answers: saved.map((row) => ({
            ...row,
            answer: answer.parse(row.answer),
        })),
        help,
    };
}

export function forBlock(history: History, blockId: number): BlockHistory {
    return {
        answers: history.answers.filter((saved) => saved.blockId === blockId),
        help: history.help
            .filter((event) => event.blockId === blockId)
            .map(({ kind }) => kind),
    };
}

function hintsSeen(history: BlockHistory) {
    return history.help.filter((kind) => kind === 'hint').length;
}

export function earnedOf(block: CheckBlock, history: BlockHistory) {
    const { content } = block;

    return {
        hints: content.hints.slice(0, hintsSeen(history)),
        example: history.help.includes('example') ? content.example : null,
        praise: history.answers.some(({ outcome }) => outcome === 'correct')
            ? content.praise
            : null,
        reveal: history.help.includes('reveal')
            ? { answer: content.answer, text: content.reveal }
            : null,
    };
}

export function earnedFor(block: Block, history: BlockHistory) {
    return block.kind === 'check' ? earnedOf(block, history) : null;
}

export function isClosed(block: Block, history: BlockHistory) {
    if (block.kind !== 'check') {
        return history.answers.length > 0;
    }

    return (
        history.answers.some(({ outcome }) => outcome === 'correct') ||
        history.help.includes('reveal')
    );
}

function requireOption(options: { id: string }[], choice: string) {
    if (!options.some((option) => option.id === choice)) {
        throw fieldError('answer/choice', 'Choose one of the options');
    }
}

export function judge(block: Block, given: Answer): Outcome {
    switch (given.kind) {
        case 'hook':
            if (block.kind !== 'hook') break;
            requireOption(block.content.options, given.choice);
            return 'accepted';
        case 'check':
            if (block.kind !== 'check') break;
            if (!block.content.activity) {
                requireOption(block.content.options ?? [], given.choice);
            } else if (answerProblem(block.content.activity, given.choice)) {
                throw fieldError('answer/choice', 'Finish the activity');
            }
            if (block.content.reason && !given.reason) {
                throw fieldError('answer/reason', 'Write the reason');
            }
            return given.choice === block.content.answer
                ? 'correct'
                : 'not_yet';
        case 'challenge':
            if (block.kind !== 'challenge') break;
            requireOption(block.content.options, given.choice);
            return 'accepted';
        case 'reflection': {
            if (block.kind !== 'reflection') break;
            const { topics } = block.content;

            for (const field of ['understood', 'confusing'] as const) {
                if (!given[field].every((topic) => topics.includes(topic))) {
                    throw fieldError(
                        `answer/${field}`,
                        'Choose topics of this reflection',
                    );
                }
            }
            return 'accepted';
        }
    }

    throw fieldError(
        'answer/kind',
        `A ${block.kind} block takes no ${given.kind} answer`,
    );
}

export function placedRight(block: Block, given: Answer, outcome: Outcome) {
    return block.kind === 'check' &&
        given.kind === 'check' &&
        outcome === 'not_yet' &&
        block.content.activity
        ? inPlace(block.content.activity, given.choice, block.content.answer)
        : null;
}

export function followUp(
    block: Block,
    history: BlockHistory,
    tryNumber: number,
    outcome: Outcome,
    helpFirst: Adaptation['helpFirst'] = null,
): HelpKind | null {
    if (block.kind !== 'check' || outcome !== 'not_yet') {
        return null;
    }

    if (tryNumber === TRY_LIMIT) {
        return 'reveal';
    }

    if (helpFirst === 'example' && !history.help.includes('example')) {
        return 'example';
    }

    return hintsSeen(history) < block.content.hints.length ? 'hint' : null;
}

export function doneOf(blocks: Block[], history: History) {
    const reflection = blocks.find(
        (block): block is Extract<Block, { kind: 'reflection' }> =>
            block.kind === 'reflection',
    );
    const given =
        reflection &&
        history.answers.find((saved) => saved.blockId === reflection.id)
            ?.answer;

    return {
        takeaways: reflection?.content.takeaways ?? [],
        toPractise: given?.kind === 'reflection' ? given.confusing : [],
    };
}

export function stateOf(
    attempt: {
        id: number;
        status: typeof attempts.$inferSelect.status;
        currentBlockId: number;
        adaptation: unknown;
    },
    blocks: Block[],
    history: History,
) {
    return {
        id: attempt.id,
        status: attempt.status,
        checkpoint: attempt.currentBlockId,
        answers: history.answers,
        done: attempt.status === 'submitted' ? doneOf(blocks, history) : null,
        adaptation: adaptationPair.nullable().parse(attempt.adaptation),
    };
}

import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { queueAnalysis } from '../../analysis/runner.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    attempts,
    classes,
    classMembers,
    helpEvents,
    learnerAdaptations,
    responses,
    sessionThemes,
    studentProfiles,
    studentSettings,
    type Adaptation,
} from '../../db/schema.ts';
import { adaptationPair, followedPair } from '../../learning/adaptation.ts';
import { isMissionKind, stepOfKind } from '../../learning/blocks.ts';
import { liveOf, stepIndex } from '../../learning/live.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { isUniqueViolation } from '../../lib/unique-violation.ts';
import { classroomOf } from '../classes/queries.ts';
import {
    alreadyAnswered,
    assignmentFor,
    blockOf,
    blocksOf,
    doneOf,
    earnedFor,
    earnedOf,
    followUp,
    forBlock,
    historyOf,
    isClosed,
    judge,
    placedRight,
    lockedAttempt,
    openAttempt,
    stateOf,
} from './attempts.ts';
import { cardsOf } from './cards.ts';
import { answerExtra, extraOf } from './extra.ts';
import { isStageLocked, pathOf, stageLocked } from './path.ts';
import { answerReview, lockTries, reviewOf } from './review.ts';
import { DEFAULT_SETTINGS, INTERESTS, settingsResponse } from './schema.ts';
import type {
    AssignmentParams,
    AttemptParams,
    CheckpointBody,
    HelpBody,
    JoinClassBody,
    ProfileBody,
    ResponseBody,
    ReviewQuery,
    ReviewTryBody,
    SettingsBody,
} from './schema.ts';

const alreadyInClass = () =>
    new AppError(409, {
        message: 'The student is already in a class',
        code: 'ALREADY_IN_CLASS',
    });

export async function myClass(request: FastifyRequest) {
    return {
        classroom: await classroomOf(
            request.server.db,
            currentUser(request).id,
        ),
    };
}

export async function joinClass(
    request: FastifyRequest<{ Body: JoinClassBody }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const student = currentUser(request);

    if (await classroomOf(db, student.id)) {
        throw alreadyInClass();
    }

    const [target] = await db
        .select({ id: classes.id })
        .from(classes)
        .where(eq(classes.inviteCode, request.body.inviteCode))
        .limit(1);

    if (!target) {
        throw fieldError('inviteCode', 'Class code not found');
    }

    await db
        .insert(classMembers)
        .values({ studentId: student.id, classId: target.id })
        .catch((error: unknown) => {
            throw isUniqueViolation(error) ? alreadyInClass() : error;
        });

    return reply
        .code(201)
        .send({ classroom: await classroomOf(db, student.id) });
}

export async function myPath(request: FastifyRequest) {
    return pathOf(request.server.db, currentUser(request).id);
}

export async function myCards(request: FastifyRequest) {
    return cardsOf(request.server.db, currentUser(request).id);
}

export async function leaveClass(request: FastifyRequest, reply: FastifyReply) {
    await request.server.db
        .delete(classMembers)
        .where(eq(classMembers.studentId, currentUser(request).id));

    return reply.code(204).send();
}

async function attemptOf(request: FastifyRequest, assignmentId: number) {
    const [attempt] = await request.server.db
        .select({
            id: attempts.id,
            status: attempts.status,
            currentBlockId: attempts.currentBlockId,
            theme: attempts.theme,
            adaptation: attempts.adaptation,
        })
        .from(attempts)
        .where(
            and(
                eq(attempts.assignmentId, assignmentId),
                eq(attempts.studentId, currentUser(request).id),
            ),
        );

    return attempt;
}

export async function assignmentDetail(
    request: FastifyRequest<{ Params: AssignmentParams }>,
) {
    const { db } = request.server;
    const { sessionId, ...assignment } = await assignmentFor(
        db,
        currentUser(request).id,
        request.params.assignmentId,
    );
    if (await isStageLocked(db, currentUser(request).id, assignment.id)) {
        throw stageLocked();
    }

    const attempt = await attemptOf(request, assignment.id);
    const blocks = await blocksOf(db, sessionId, attempt?.theme ?? null);
    const history = attempt
        ? await historyOf(db, attempt.id)
        : { answers: [], help: [] };

    return {
        ...assignment,
        blocks: blocks.map((block) =>
            block.kind === 'check'
                ? {
                      ...block,
                      step: stepOfKind[block.kind],
                      earned: earnedOf(block, forBlock(history, block.id)),
                  }
                : { ...block, step: stepOfKind[block.kind] },
        ),
        attempt: attempt ? stateOf(attempt, blocks, history) : null,
    };
}

export async function startAttempt(
    request: FastifyRequest<{ Params: AssignmentParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const studentId = currentUser(request).id;
    const assignment = await assignmentFor(
        db,
        studentId,
        request.params.assignmentId,
    );

    if (await isStageLocked(db, studentId, assignment.id)) {
        throw stageLocked();
    }

    const base = await blocksOf(db, assignment.sessionId, null);

    if (base.length === 0) {
        throw notFound('This session has no content yet');
    }

    const existing = await attemptOf(request, assignment.id);
    const created =
        !existing &&
        (await db.transaction(async (tx) => {
            const settings = await settingsOf(tx, studentId);
            const [row] = await tx
                .select({
                    off: learnerAdaptations.off,
                    source: learnerAdaptations.source,
                    helpFirst: learnerAdaptations.helpFirst,
                    lead: learnerAdaptations.lead,
                    aiHelpFirst: learnerAdaptations.aiHelpFirst,
                    aiLead: learnerAdaptations.aiLead,
                })
                .from(learnerAdaptations)
                .where(
                    and(
                        eq(learnerAdaptations.studentId, studentId),
                        eq(learnerAdaptations.subject, assignment.subject),
                        eq(learnerAdaptations.classId, assignment.classId),
                    ),
                )
                .for('share');
            const followed = ownReading(
                followedPair(row),
                settings.readAloudChosen,
            );
            const inserted = await tx
                .insert(attempts)
                .values({
                    assignmentId: assignment.id,
                    studentId,
                    currentBlockId: base[0].id,
                    readAloud: settings.readAloud || followed?.lead === 'audio',
                    theme: await themeFor(tx, studentId, assignment.sessionId),
                    adaptation: followed,
                })
                .onConflictDoNothing()
                .returning({ id: attempts.id });

            return inserted.length > 0;
        }));
    const attempt = existing ?? (await attemptOf(request, assignment.id));
    const blocks = attempt.theme
        ? await blocksOf(db, assignment.sessionId, attempt.theme)
        : base;

    return reply
        .code(created ? 201 : 200)
        .send(stateOf(attempt, blocks, await historyOf(db, attempt.id)));
}

function ownReading(
    followed: Adaptation | null,
    readAloudChosen: boolean,
): Adaptation | null {
    if (followed?.lead !== 'audio' || !readAloudChosen) return followed;

    return followed.helpFirst === null ? null : { ...followed, lead: null };
}

async function themeFor(db: Queryable, studentId: number, sessionId: number) {
    const [profile] = await db
        .select({ interests: studentProfiles.interests })
        .from(studentProfiles)
        .where(eq(studentProfiles.studentId, studentId));

    if (!profile || profile.interests.length === 0) return null;

    const ready = await db
        .select({ theme: sessionThemes.theme })
        .from(sessionThemes)
        .where(
            and(
                eq(sessionThemes.learningSessionId, sessionId),
                isNull(sessionThemes.drafting),
                isNotNull(sessionThemes.readAt),
            ),
        );
    const themed = new Set(ready.map(({ theme }) => theme));

    return (
        INTERESTS.find(
            (key) => profile.interests.includes(key) && themed.has(key),
        ) ?? null
    );
}

export async function moveCheckpoint(
    request: FastifyRequest<{ Params: AttemptParams; Body: CheckpointBody }>,
    reply: FastifyReply,
) {
    const studentId = currentUser(request).id;

    await request.server.db.transaction(async (tx) => {
        const attempt = await openAttempt(
            tx,
            studentId,
            request.params.attemptId,
        );
        const block = await blockOf(
            tx,
            attempt.sessionId,
            request.body.blockId,
            attempt.theme,
        );
        const { live } = attempt;

        if (
            live?.state === 'open' &&
            live.mode === 'together' &&
            isMissionKind(block.kind) &&
            stepIndex(stepOfKind[block.kind]) > stepIndex(live.openStep)
        ) {
            throw new AppError(409, {
                message: 'The teacher has not opened this step yet',
                code: 'LIVE_WAIT',
            });
        }

        await tx
            .update(attempts)
            .set({ currentBlockId: block.id })
            .where(eq(attempts.id, attempt.id));
    });

    return reply.code(204).send();
}

export async function myLive(
    request: FastifyRequest<{ Params: AssignmentParams }>,
) {
    const { db } = request.server;
    const studentId = currentUser(request).id;
    const assignment = await assignmentFor(
        db,
        studentId,
        request.params.assignmentId,
    );

    await db
        .update(attempts)
        .set({ lastSeenAt: new Date() })
        .where(
            and(
                eq(attempts.assignmentId, assignment.id),
                eq(attempts.studentId, studentId),
            ),
        );

    return { live: await liveOf(db, assignment.id) };
}

export async function answerBlock(
    request: FastifyRequest<{ Params: AttemptParams; Body: ResponseBody }>,
    reply: FastifyReply,
) {
    const studentId = currentUser(request).id;
    const { blockId, tryNumber, answer: given } = request.body;
    const result = await request.server.db.transaction(async (tx) => {
        const attempt = await openAttempt(
            tx,
            studentId,
            request.params.attemptId,
        );
        const block = await blockOf(
            tx,
            attempt.sessionId,
            blockId,
            attempt.theme,
        );
        const before = forBlock(await historyOf(tx, attempt.id), block.id);
        const sent = before.answers.find(
            (saved) => saved.tryNumber === tryNumber,
        );

        if (sent) {
            return {
                created: false,
                outcome: sent.outcome,
                earned: earnedFor(block, before),
                inPlace: placedRight(block, sent.answer, sent.outcome),
            };
        }

        if (isClosed(block, before)) {
            throw alreadyAnswered();
        }

        if (tryNumber !== before.answers.length + 1) {
            throw fieldError(
                'tryNumber',
                `The next try is number ${before.answers.length + 1}`,
            );
        }

        const outcome = judge(block, given);
        const help = followUp(
            block,
            before,
            tryNumber,
            outcome,
            adaptationPair.nullable().parse(attempt.adaptation)?.helpFirst ??
                null,
        );

        await tx.insert(responses).values({
            attemptId: attempt.id,
            blockId: block.id,
            tryNumber,
            answer: given,
            outcome,
        });

        if (help) {
            await tx.insert(helpEvents).values({
                attemptId: attempt.id,
                blockId: block.id,
                kind: help,
                given: true,
            });
        }

        return {
            created: true,
            outcome,
            inPlace: placedRight(block, given, outcome),
            earned: earnedFor(block, {
                answers: [
                    ...before.answers,
                    { blockId: block.id, tryNumber, answer: given, outcome },
                ],
                help: help ? [...before.help, help] : before.help,
            }),
        };
    });

    return reply.code(result.created ? 201 : 200).send({
        outcome: result.outcome,
        earned: result.earned,
        inPlace: result.inPlace,
    });
}

export async function askForHelp(
    request: FastifyRequest<{ Params: AttemptParams; Body: HelpBody }>,
    reply: FastifyReply,
) {
    const studentId = currentUser(request).id;
    const { blockId, kind } = request.body;
    const earned = await request.server.db.transaction(async (tx) => {
        const attempt = await openAttempt(
            tx,
            studentId,
            request.params.attemptId,
        );
        const block = await blockOf(
            tx,
            attempt.sessionId,
            blockId,
            attempt.theme,
        );
        const before = forBlock(await historyOf(tx, attempt.id), block.id);

        if (kind === 'listen') {
            if (block.kind !== 'check' && block.kind !== 'challenge') {
                throw fieldError('kind', 'Only a question can be listened to');
            }
        } else if (kind !== 'ask_teacher') {
            if (block.kind !== 'check') {
                throw fieldError('kind', 'This block has no hints or examples');
            }

            const shown = before.help.filter((seen) => seen === 'hint').length;

            if (kind === 'hint' && shown >= block.content.hints.length) {
                throw fieldError('kind', 'Every hint is already shown');
            }
        }

        await tx
            .insert(helpEvents)
            .values({ attemptId: attempt.id, blockId: block.id, kind });

        return earnedFor(block, { ...before, help: [...before.help, kind] });
    });

    return reply.code(201).send({ earned });
}

export async function submitAttempt(
    request: FastifyRequest<{ Params: AttemptParams }>,
) {
    const studentId = currentUser(request).id;

    return request.server.db.transaction(async (tx) => {
        const attempt = await lockedAttempt(
            tx,
            studentId,
            request.params.attemptId,
        );

        if (attempt.status === 'in_progress') {
            await tx
                .update(attempts)
                .set({ status: 'submitted', submittedAt: new Date() })
                .where(eq(attempts.id, attempt.id));
            await queueAnalysis(tx, attempt.id);
        }

        return doneOf(
            await blocksOf(tx, attempt.sessionId, attempt.theme),
            await historyOf(tx, attempt.id),
        );
    });
}

const inOrder = (chosen: readonly string[]) =>
    INTERESTS.filter((key) => chosen.includes(key));

const profileColumns = {
    interests: studentProfiles.interests,
    updatedAt: studentProfiles.updatedAt,
};

export async function myProfile(request: FastifyRequest) {
    const [profile] = await request.server.db
        .select(profileColumns)
        .from(studentProfiles)
        .where(eq(studentProfiles.studentId, currentUser(request).id));

    return {
        profile: profile
            ? { ...profile, interests: inOrder(profile.interests) }
            : null,
    };
}

export async function saveProfile(
    request: FastifyRequest<{ Body: ProfileBody }>,
) {
    const interests = inOrder(request.body.interests);
    const [profile] = await request.server.db
        .insert(studentProfiles)
        .values({ studentId: currentUser(request).id, interests })
        .onConflictDoUpdate({
            target: studentProfiles.studentId,
            set: { interests, updatedAt: new Date() },
        })
        .returning(profileColumns);

    return { profile: { ...profile, interests } };
}

const settingsColumns = {
    textSize: studentSettings.textSize,
    readAloud: studentSettings.readAloud,
    speechRate: studentSettings.speechRate,
    readAloudChosen: studentSettings.readAloudChosen,
};

async function settingsOf(db: Queryable, studentId: number) {
    const [settings] = await db
        .select(settingsColumns)
        .from(studentSettings)
        .where(eq(studentSettings.studentId, studentId));

    return settings ? settingsResponse.parse(settings) : DEFAULT_SETTINGS;
}

export async function mySettings(request: FastifyRequest) {
    return settingsOf(request.server.db, currentUser(request).id);
}

export async function saveSettings(
    request: FastifyRequest<{ Body: SettingsBody }>,
) {
    const studentId = currentUser(request).id;
    const { readAloudChosen, ...settings } = request.body;
    const chosen = readAloudChosen === true;

    const stored = await request.server.db.transaction(async (tx) => {
        const [row] = await tx
            .insert(studentSettings)
            .values({ studentId, ...settings, readAloudChosen: chosen })
            .onConflictDoUpdate({
                target: studentSettings.studentId,
                set: {
                    ...settings,
                    updatedAt: new Date(),
                    ...(chosen ? { readAloudChosen: true } : {}),
                },
            })
            .returning(settingsColumns);

        if (settings.readAloud) {
            await tx
                .update(attempts)
                .set({ readAloud: true })
                .where(
                    and(
                        eq(attempts.studentId, studentId),
                        eq(attempts.status, 'in_progress'),
                    ),
                );
        }

        return row;
    });

    return settingsResponse.parse(stored);
}

export async function myReview(
    request: FastifyRequest<{ Querystring: ReviewQuery }>,
) {
    return reviewOf(
        request.server.db,
        currentUser(request).id,
        request.query.subject,
    );
}

export async function myExtra(
    request: FastifyRequest<{ Querystring: ReviewQuery }>,
) {
    return extraOf(
        request.server.db,
        currentUser(request).id,
        request.query.subject,
    );
}

export async function answerExtraQuestion(
    request: FastifyRequest<{ Body: ReviewTryBody }>,
    reply: FastifyReply,
) {
    const studentId = currentUser(request).id;

    return reply.code(201).send(
        await request.server.db.transaction(async (tx) => {
            await lockTries(tx, studentId, request.body.blockId);

            return answerExtra(tx, studentId, request.body);
        }),
    );
}

export async function answerReviewQuestion(
    request: FastifyRequest<{ Body: ReviewTryBody }>,
    reply: FastifyReply,
) {
    const studentId = currentUser(request).id;

    return reply.code(201).send(
        await request.server.db.transaction(async (tx) => {
            await lockTries(tx, studentId, request.body.blockId);

            return answerReview(tx, studentId, request.body);
        }),
    );
}

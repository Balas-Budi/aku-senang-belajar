import { and, asc, desc, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import {
    assignments,
    attempts,
    classes,
    classMembers,
    helpEvents,
    learningSessions,
    materials,
    modules,
    responses,
    sessionBlocks,
} from '../../db/schema.ts';
import { stepOfKind } from '../../learning/blocks.ts';
import { AppError } from '../../lib/errors.ts';
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
    lockedAttempt,
    notFound,
    openAttempt,
    stateOf,
} from './attempts.ts';
import type {
    AssignmentParams,
    AttemptParams,
    CheckpointBody,
    HelpBody,
    JoinClassBody,
    ResponseBody,
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

export async function myAssignments(request: FastifyRequest) {
    const rows = await request.server.db
        .select({
            id: assignments.id,
            title: learningSessions.title,
            summary: learningSessions.summary,
            subject: materials.subject,
            moduleTitle: modules.title,
            status: attempts.status,
            checkpointKind: sessionBlocks.kind,
        })
        .from(classMembers)
        .innerJoin(assignments, eq(assignments.classId, classMembers.classId))
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .leftJoin(
            attempts,
            and(
                eq(attempts.assignmentId, assignments.id),
                eq(attempts.studentId, classMembers.studentId),
            ),
        )
        .leftJoin(sessionBlocks, eq(sessionBlocks.id, attempts.currentBlockId))
        .where(
            and(
                eq(classMembers.studentId, currentUser(request).id),
                eq(learningSessions.status, 'ready'),
            ),
        )
        .orderBy(desc(assignments.assignedAt), asc(assignments.id));

    return rows.map(({ status, checkpointKind, ...assignment }) => ({
        ...assignment,
        progress: status ?? ('not_started' as const),
        step:
            status === 'in_progress' && checkpointKind
                ? stepOfKind[checkpointKind]
                : null,
    }));
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
    const blocks = await blocksOf(db, sessionId);
    const attempt = await attemptOf(request, assignment.id);
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
    const blocks = await blocksOf(db, assignment.sessionId);

    if (blocks.length === 0) {
        throw notFound('This session has no content yet');
    }

    const [created] = await db
        .insert(attempts)
        .values({
            assignmentId: assignment.id,
            studentId,
            currentBlockId: blocks[0].id,
        })
        .onConflictDoNothing()
        .returning({ id: attempts.id });
    const attempt = await attemptOf(request, assignment.id);

    return reply
        .code(created ? 201 : 200)
        .send(stateOf(attempt, blocks, await historyOf(db, attempt.id)));
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
        );

        await tx
            .update(attempts)
            .set({ currentBlockId: block.id })
            .where(eq(attempts.id, attempt.id));
    });

    return reply.code(204).send();
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
        const block = await blockOf(tx, attempt.sessionId, blockId);
        const before = forBlock(await historyOf(tx, attempt.id), block.id);
        const sent = before.answers.find(
            (saved) => saved.tryNumber === tryNumber,
        );

        if (sent) {
            return {
                created: false,
                outcome: sent.outcome,
                earned: earnedFor(block, before),
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
        const help = followUp(block, before, tryNumber, outcome);

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
            });
        }

        return {
            created: true,
            outcome,
            earned: earnedFor(block, {
                answers: [
                    ...before.answers,
                    { blockId: block.id, tryNumber, answer: given, outcome },
                ],
                help: help ? [...before.help, help] : before.help,
            }),
        };
    });

    return reply
        .code(result.created ? 201 : 200)
        .send({ outcome: result.outcome, earned: result.earned });
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
        const block = await blockOf(tx, attempt.sessionId, blockId);
        const before = forBlock(await historyOf(tx, attempt.id), block.id);

        if (kind !== 'ask_teacher') {
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
        }

        return doneOf(
            await blocksOf(tx, attempt.sessionId),
            await historyOf(tx, attempt.id),
        );
    });
}

import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import {
    attempts,
    helpEvents,
    liveSessions,
    sessionBlocks,
} from '../../db/schema.ts';
import { isMissionKind, stepOfKind, steps } from '../../learning/blocks.ts';
import { liveOf, stepIndex, type Step } from '../../learning/live.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { membersOf } from '../classes/queries.ts';
import { ownedAssignment } from '../results/queries.ts';
import type {
    ChangeBody,
    LiveParams,
    OpenBody,
    RequestParams,
} from './schema.ts';

const SEEN_WITHIN_MS = 20_000;
const MINUTE_MS = 60_000;

const stepOf = (
    kind: (typeof sessionBlocks.$inferSelect)['kind'],
): Step | null => (isMissionKind(kind) ? stepOfKind[kind] : null);

const wrongState = (message: string) =>
    new AppError(409, { message, code: 'LIVE_STATE' });

export async function liveMonitor(
    request: FastifyRequest<{ Params: LiveParams }>,
) {
    const { db } = request.server;
    const assignment = await ownedAssignment(
        db,
        currentUser(request).id,
        request.params,
    );
    const members = await membersOf(db, assignment.classId);
    const ids = members.map(({ id }) => id);
    const taken =
        ids.length === 0
            ? []
            : await db
                  .select({
                      id: attempts.id,
                      studentId: attempts.studentId,
                      status: attempts.status,
                      lastSeenAt: attempts.lastSeenAt,
                      kind: sessionBlocks.kind,
                  })
                  .from(attempts)
                  .innerJoin(
                      sessionBlocks,
                      eq(sessionBlocks.id, attempts.currentBlockId),
                  )
                  .where(
                      and(
                          eq(attempts.assignmentId, assignment.id),
                          inArray(attempts.studentId, ids),
                      ),
                  );
    const asked =
        taken.length === 0
            ? []
            : await db
                  .select({
                      id: helpEvents.id,
                      attemptId: helpEvents.attemptId,
                      kind: sessionBlocks.kind,
                      askedAt: helpEvents.createdAt,
                  })
                  .from(helpEvents)
                  .innerJoin(
                      sessionBlocks,
                      eq(sessionBlocks.id, helpEvents.blockId),
                  )
                  .where(
                      and(
                          inArray(
                              helpEvents.attemptId,
                              taken.map(({ id }) => id),
                          ),
                          eq(helpEvents.kind, 'ask_teacher'),
                          isNull(helpEvents.handledAt),
                      ),
                  )
                  .orderBy(asc(helpEvents.createdAt), asc(helpEvents.id));
    const byStudent = new Map(taken.map((row) => [row.studentId, row]));
    const byAttempt = new Map(taken.map((row) => [row.id, row]));
    const names = new Map(members.map(({ id, name }) => [id, name]));
    const seenSince = Date.now() - SEEN_WITHIN_MS;

    return {
        live: await liveOf(db, assignment.id),
        students: members.map(({ id, name }) => {
            const attempt = byStudent.get(id);

            return {
                id,
                name,
                state: !attempt
                    ? ('not_started' as const)
                    : attempt.status === 'submitted'
                      ? ('done' as const)
                      : attempt.lastSeenAt &&
                          attempt.lastSeenAt.getTime() >= seenSince
                        ? ('active' as const)
                        : ('offline' as const),
                step:
                    attempt && attempt.status !== 'submitted'
                        ? stepOf(attempt.kind)
                        : null,
            };
        }),
        requests: asked.flatMap((request) => {
            const attempt = byAttempt.get(request.attemptId);

            return attempt
                ? [
                      {
                          id: request.id,
                          studentId: attempt.studentId,
                          name: names.get(attempt.studentId) ?? '',
                          step: stepOf(request.kind),
                          askedAt: request.askedAt,
                      },
                  ]
                : [];
        }),
    };
}

export async function openLive(
    request: FastifyRequest<{ Params: LiveParams; Body: OpenBody }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const teacherId = currentUser(request).id;
    const assignment = await ownedAssignment(db, teacherId, request.params);
    const { mode, minutes } = request.body;
    const now = new Date();
    const fresh = {
        mode,
        state: 'open' as const,
        openStep: mode === 'together' ? ('opening' as const) : steps[3],
        endsAt: minutes ? new Date(now.getTime() + minutes * MINUTE_MS) : null,
        startedBy: teacherId,
        startedAt: now,
        pausedAt: null,
        endedAt: null,
    };
    const live = await db.transaction(async (tx) => {
        const [current] = await tx
            .select()
            .from(liveSessions)
            .where(eq(liveSessions.assignmentId, assignment.id))
            .for('update');
        const running =
            current &&
            (current.state === 'paused' ||
                (current.state === 'open' &&
                    !(current.endsAt && current.endsAt <= now)));

        if (running) {
            throw new AppError(409, {
                message: 'A live session is already open for this mission',
                code: 'LIVE_OPEN',
            });
        }

        const [row] = await tx
            .insert(liveSessions)
            .values({ assignmentId: assignment.id, ...fresh })
            .onConflictDoUpdate({
                target: liveSessions.assignmentId,
                set: fresh,
            })
            .returning();

        return row;
    });

    return reply.code(201).send({ live });
}

export async function changeLive(
    request: FastifyRequest<{ Params: LiveParams; Body: ChangeBody }>,
) {
    const { db } = request.server;
    const assignment = await ownedAssignment(
        db,
        currentUser(request).id,
        request.params,
    );
    const { action, minutes = 5 } = request.body;

    return db.transaction(async (tx) => {
        const [stored] = await tx
            .select({ id: liveSessions.id })
            .from(liveSessions)
            .where(eq(liveSessions.assignmentId, assignment.id))
            .for('update');
        const live = stored && (await liveOf(tx, assignment.id));

        if (!live || live.state === 'ended') {
            throw wrongState('No live session is open for this mission');
        }

        const now = new Date();
        const change = () => {
            switch (action) {
                case 'pause':
                    if (live.state !== 'open') {
                        throw wrongState('The session is not running');
                    }
                    return { state: 'paused' as const, pausedAt: now };
                case 'resume':
                    if (live.state !== 'paused') {
                        throw wrongState('The session is not paused');
                    }
                    return {
                        state: 'open' as const,
                        pausedAt: null,
                        endsAt:
                            live.endsAt && live.pausedAt
                                ? new Date(
                                      live.endsAt.getTime() +
                                          now.getTime() -
                                          live.pausedAt.getTime(),
                                  )
                                : live.endsAt,
                    };
                case 'advance': {
                    const next = steps[stepIndex(live.openStep) + 1];

                    if (live.mode !== 'together' || live.state !== 'open') {
                        throw wrongState(
                            'Only a running session taken together opens steps',
                        );
                    }
                    if (!next) throw wrongState('Every step is already open');
                    return { openStep: next };
                }
                case 'extend':
                    return {
                        endsAt: new Date(
                            (live.endsAt ?? now).getTime() +
                                minutes * MINUTE_MS,
                        ),
                    };
                case 'end':
                    return { state: 'ended' as const, endedAt: now };
            }
        };
        const [row] = await tx
            .update(liveSessions)
            .set(change())
            .where(eq(liveSessions.id, live.id))
            .returning();

        return { live: row };
    });
}

export async function handleRequest(
    request: FastifyRequest<{ Params: RequestParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const assignment = await ownedAssignment(
        db,
        currentUser(request).id,
        request.params,
    );
    const handled = await db
        .update(helpEvents)
        .set({ handledAt: new Date() })
        .where(
            and(
                eq(helpEvents.id, request.params.helpId),
                eq(helpEvents.kind, 'ask_teacher'),
                inArray(
                    helpEvents.attemptId,
                    db
                        .select({ id: attempts.id })
                        .from(attempts)
                        .where(eq(attempts.assignmentId, assignment.id)),
                ),
            ),
        )
        .returning({ id: helpEvents.id });

    if (handled.length === 0) throw notFound('Request not found');

    return reply.code(204).send();
}

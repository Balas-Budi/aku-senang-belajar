import { and, asc, desc, eq, ne } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AiError, chatJson, requireAiConfig } from '../../ai/chat.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    challengeAnswers,
    classChallenges,
    classes,
    classMembers,
    learningSessions,
    sessionBlocks,
} from '../../db/schema.ts';
import { blockContent } from '../../learning/blocks.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { isUniqueViolation } from '../../lib/unique-violation.ts';
import { membersOf, ownedClassId } from '../classes/queries.ts';
import {
    CHALLENGE_PROMPT,
    checkClusters,
    clusterMessage,
    clusterReply,
} from './clusters.ts';
import type {
    AnswerBody,
    ChallengeParams,
    ChangeBody,
    StartBody,
} from './schema.ts';

type Challenge = typeof classChallenges.$inferSelect;

const MIN_TO_CLUSTER = 3;
const CLUSTER_TIMEOUT = 90_000;

const wrongState = (message: string) =>
    new AppError(409, { message, code: 'CHALLENGE_STATE' });

async function newestOf(db: Queryable, classId: number) {
    const [challenge] = await db
        .select()
        .from(classChallenges)
        .where(eq(classChallenges.classId, classId))
        .orderBy(desc(classChallenges.id))
        .limit(1);

    return challenge;
}

function answersOf(db: Queryable, challengeId: number) {
    return db
        .select()
        .from(challengeAnswers)
        .where(eq(challengeAnswers.challengeId, challengeId))
        .orderBy(asc(challengeAnswers.id));
}

const countsOf = (challenge: Challenge, answers: { choice: string }[]) =>
    challenge.options.map(({ id }) => ({
        id,
        count: answers.filter(({ choice }) => choice === id).length,
    }));

async function teacherView(db: Queryable, challenge: Challenge) {
    const members = await membersOf(db, challenge.classId);
    const names = new Map(members.map(({ id, name }) => [id, name]));
    const answers = await answersOf(db, challenge.id);

    return {
        id: challenge.id,
        prompt: challenge.prompt,
        options: challenge.options,
        mode: challenge.mode,
        state: challenge.state,
        units:
            challenge.mode === 'group'
                ? challenge.groups.length
                : members.length,
        answered: answers.length,
        groups: challenge.groups.map(({ id, studentIds }) => ({
            id,
            name: `Kelompok ${id}`,
            members: studentIds.flatMap((student) => names.get(student) ?? []),
        })),
        counts: countsOf(challenge, answers),
        answers: answers.map(({ id, choice, reason }) => ({
            id,
            choice,
            reason,
            shown: challenge.shown.includes(id),
        })),
        clusters: challenge.clusters,
        createdAt: challenge.createdAt,
    };
}

export async function classChallenge(
    request: FastifyRequest<{ Params: ChallengeParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );
    const challenge = await newestOf(db, classId);

    return { challenge: challenge ? await teacherView(db, challenge) : null };
}

export async function challengeSources(
    request: FastifyRequest<{ Params: ChallengeParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );
    const rows = await db
        .select({
            blockId: sessionBlocks.id,
            mission: learningSessions.title,
            content: sessionBlocks.content,
        })
        .from(assignments)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(
            sessionBlocks,
            eq(sessionBlocks.learningSessionId, learningSessions.id),
        )
        .where(
            and(
                eq(assignments.classId, classId),
                eq(learningSessions.status, 'ready'),
                eq(sessionBlocks.kind, 'challenge'),
            ),
        )
        .orderBy(asc(assignments.id));

    return {
        sources: rows.flatMap(({ blockId, mission, content }) => {
            const parsed = blockContent.challenge.safeParse(content);

            return parsed.success
                ? [
                      {
                          blockId,
                          mission,
                          prompt: `${parsed.data.prompt} ${parsed.data.question}`,
                          options: parsed.data.options.map(({ id, label }) => ({
                              id,
                              label,
                          })),
                      },
                  ]
                : [];
        }),
    };
}

export async function startChallenge(
    request: FastifyRequest<{ Params: ChallengeParams; Body: StartBody }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const teacherId = currentUser(request).id;
    const classId = await ownedClassId(db, request.params.classId, teacherId);
    const { prompt, options, mode, groupSize = 1 } = request.body;
    const challenge = await db.transaction(async (tx) => {
        await tx
            .select({ id: classes.id })
            .from(classes)
            .where(eq(classes.id, classId))
            .for('update');

        const [running] = await tx
            .select({ id: classChallenges.id })
            .from(classChallenges)
            .where(
                and(
                    eq(classChallenges.classId, classId),
                    ne(classChallenges.state, 'closed'),
                ),
            );

        if (running) {
            throw new AppError(409, {
                message: 'This class already has a challenge running',
                code: 'CHALLENGE_OPEN',
            });
        }

        const members = await membersOf(tx, classId);

        if (members.length === 0) {
            throw new AppError(409, {
                message: 'The class has no students yet',
                code: 'CLASS_EMPTY',
            });
        }

        const groups =
            mode === 'group'
                ? Array.from(
                      { length: Math.ceil(members.length / groupSize) },
                      (_, index) => ({
                          id: index + 1,
                          studentIds: members
                              .slice(index * groupSize, (index + 1) * groupSize)
                              .map(({ id }) => id),
                      }),
                  )
                : [];
        const [row] = await tx
            .insert(classChallenges)
            .values({
                classId,
                teacherId,
                prompt,
                options,
                mode,
                groups,
                shown: [],
            })
            .returning();

        return row;
    });

    return reply
        .code(201)
        .send({ challenge: await teacherView(db, challenge) });
}

async function clustersOf(request: FastifyRequest, challenge: Challenge) {
    const answers = await answersOf(request.server.db, challenge.id);

    if (answers.length < MIN_TO_CLUSTER) {
        throw new AppError(409, {
            message: `Grouping needs at least ${MIN_TO_CLUSTER} answers`,
            code: 'TOO_FEW_ANSWERS',
        });
    }

    try {
        const { value } = await chatJson(
            requireAiConfig(request.server.env),
            {
                system: CHALLENGE_PROMPT,
                user: clusterMessage(
                    challenge.prompt,
                    challenge.options,
                    answers,
                ),
                schema: clusterReply,
                check: checkClusters(answers.length),
            },
            CLUSTER_TIMEOUT,
        );

        return value.groups.map(({ label, note, refs }) => ({
            label,
            note,
            answerIds: refs.map((ref) => answers[ref - 1].id),
        }));
    } catch (error) {
        if (!(error instanceof AiError)) throw error;

        request.log.warn(
            { failure: error.failure, challengeId: challenge.id },
            'challenge reasons not grouped',
        );
        throw new AppError(502, {
            message: 'The AI could not group the reasons',
            code: 'AI_FAILED',
        });
    }
}

export async function changeChallenge(
    request: FastifyRequest<{ Params: ChallengeParams; Body: ChangeBody }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );
    const challenge = await newestOf(db, classId);
    const { action, answerIds = [] } = request.body;

    if (!challenge || challenge.state === 'closed') {
        throw wrongState('No challenge is running for this class');
    }
    if (action === 'reveal' && challenge.state !== 'open') {
        throw wrongState('The result is already shown');
    }
    if (
        (action === 'show' || action === 'cluster') &&
        challenge.state !== 'revealed'
    ) {
        throw wrongState('Show the result first');
    }

    const now = new Date();
    const change =
        action === 'reveal'
            ? { state: 'revealed' as const, revealedAt: now }
            : action === 'close'
              ? { state: 'closed' as const, closedAt: now }
              : action === 'cluster'
                ? { clusters: await clustersOf(request, challenge) }
                : {
                      shown: (await answersOf(db, challenge.id))
                          .map(({ id }) => id)
                          .filter((id) => answerIds.includes(id)),
                  };
    const [row] = await db
        .update(classChallenges)
        .set(change)
        .where(
            and(
                eq(classChallenges.id, challenge.id),
                eq(classChallenges.state, challenge.state),
            ),
        )
        .returning();

    if (!row) throw wrongState('The challenge changed; load it again');

    return { challenge: await teacherView(db, row) };
}

async function studentChallenge(db: Queryable, studentId: number) {
    const [member] = await db
        .select({ classId: classMembers.classId })
        .from(classMembers)
        .where(eq(classMembers.studentId, studentId));
    const challenge = member && (await newestOf(db, member.classId));

    if (!challenge || challenge.state === 'closed') return null;

    const group = challenge.groups.find(({ studentIds }) =>
        studentIds.includes(studentId),
    );
    const unit = challenge.mode === 'solo' ? studentId : group?.id;

    return unit === undefined ? null : { challenge, group, unit };
}

export async function myChallenge(request: FastifyRequest) {
    const { db } = request.server;
    const found = await studentChallenge(db, currentUser(request).id);

    if (!found) return { challenge: null };

    const { challenge, group, unit } = found;
    const answers = await answersOf(db, challenge.id);
    const own = answers.find((answer) => answer.unit === unit);
    const names = group
        ? new Map(
              (await membersOf(db, challenge.classId)).map(({ id, name }) => [
                  id,
                  name,
              ]),
          )
        : null;

    return {
        challenge: {
            id: challenge.id,
            prompt: challenge.prompt,
            options: challenge.options,
            mode: challenge.mode,
            state: challenge.state,
            group:
                group && names
                    ? {
                          name: `Kelompok ${group.id}`,
                          members: group.studentIds.flatMap(
                              (id) => names.get(id) ?? [],
                          ),
                      }
                    : null,
            answered: own ? { choice: own.choice, reason: own.reason } : null,
            result:
                challenge.state === 'revealed'
                    ? {
                          total: answers.length,
                          counts: countsOf(challenge, answers),
                          reasons: answers
                              .filter(({ id }) => challenge.shown.includes(id))
                              .map(({ choice, reason }) => ({
                                  choice,
                                  reason,
                              })),
                      }
                    : null,
        },
    };
}

export async function answerChallenge(
    request: FastifyRequest<{ Body: AnswerBody }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const studentId = currentUser(request).id;
    const found = await studentChallenge(db, studentId);
    const { challengeId, choice, reason } = request.body;

    if (!found || found.challenge.id !== challengeId) {
        throw notFound('Challenge not found');
    }
    if (found.challenge.state !== 'open') {
        throw wrongState('The challenge no longer takes answers');
    }
    if (!found.challenge.options.some(({ id }) => id === choice)) {
        throw new AppError(400, {
            message: 'Choose one of the options',
            code: 'VALIDATION_ERROR',
        });
    }

    await db
        .insert(challengeAnswers)
        .values({ challengeId, unit: found.unit, studentId, choice, reason })
        .catch((error: unknown) => {
            throw isUniqueViolation(error)
                ? new AppError(409, {
                      message: 'An answer was already sent',
                      code: 'ALREADY_ANSWERED',
                  })
                : error;
        });

    return reply.code(201).send({ answered: { choice, reason } });
}

import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    blockCompetencies,
    classMembers,
    competencies,
    followUps,
    followUpStudents,
    learningSessions,
    materials,
    modules,
    reviewTries,
    sessionBlocks,
    sessionCompetencies,
    type subject,
    users,
} from '../../db/schema.ts';
import { themedBlock, themesFor } from '../../learning/themed-blocks.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { membersOf, ownedClassId } from '../classes/queries.ts';
import { earnedOf, followUp, judge, placedRight } from '../student/attempts.ts';
import { asCheck } from '../student/extra.ts';
import { missionsOf } from '../student/missions.ts';
import {
    lockTries,
    practiceHistoryOf,
    roundOf,
    shownStatuses,
    triesOf,
} from '../student/review.ts';
import type { ReviewTryBody } from '../student/schema.ts';
import type {
    ClassParams,
    CreateBody,
    DoneBody,
    FollowUpParams,
    StudentFollowUpParams,
    StudentFollowUpsQuery,
} from './schema.ts';

type Subject = (typeof subject.enumValues)[number];
type Kind = typeof followUps.$inferSelect.kind;
type Try = typeof reviewTries.$inferSelect;
type Asked = { kind: Kind; sessionId: number; competencyId: number | null };

const QUESTIONS = 3;
const practised = (kind: Kind) => kind === 'reinforce' || kind === 'enrich';

function questionRows(db: Queryable, asked: Asked) {
    const columns = {
        id: sessionBlocks.id,
        position: sessionBlocks.position,
        kind: sessionBlocks.kind,
        content: sessionBlocks.content,
    };
    const ofMission = eq(sessionBlocks.learningSessionId, asked.sessionId);

    if (asked.kind === 'enrich') {
        return db
            .select(columns)
            .from(sessionBlocks)
            .where(and(ofMission, eq(sessionBlocks.kind, 'extra_challenge')))
            .limit(1);
    }

    if (asked.kind === 'discuss' || asked.kind === 'reteach') {
        return Promise.resolve([]);
    }

    return db
        .select(columns)
        .from(sessionBlocks)
        .innerJoin(
            blockCompetencies,
            eq(blockCompetencies.blockId, sessionBlocks.id),
        )
        .where(
            and(
                ofMission,
                eq(sessionBlocks.kind, 'check'),
                eq(blockCompetencies.competencyId, asked.competencyId ?? 0),
            ),
        )
        .orderBy(asc(sessionBlocks.position))
        .limit(QUESTIONS);
}

const closedSince = (blockIds: number[], tries: Try[], since: Date) =>
    tries.filter(
        (item) =>
            blockIds.includes(item.blockId) &&
            item.createdAt >= since &&
            (item.outcome === 'correct' || item.help === 'reveal'),
    );

function practiceOf(blockIds: number[], tries: Try[], since: Date) {
    const closed = closedSince(blockIds, tries, since);
    const count = (list: Try[]) =>
        new Set(list.map(({ blockId }) => blockId)).size;

    return {
        done: count(closed),
        total: blockIds.length,
        right: count(closed.filter(({ outcome }) => outcome === 'correct')),
    };
}

function followUpRows(db: Queryable, classId: number, followUpId?: number) {
    return db
        .select({
            id: followUps.id,
            kind: followUps.kind,
            assignmentId: followUps.assignmentId,
            sessionId: assignments.learningSessionId,
            mission: learningSessions.title,
            subject: materials.subject,
            competencyId: followUps.competencyId,
            code: competencies.code,
            description: competencies.description,
            note: followUps.note,
            createdAt: followUps.createdAt,
            doneAt: followUps.doneAt,
        })
        .from(followUps)
        .innerJoin(assignments, eq(assignments.id, followUps.assignmentId))
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .leftJoin(competencies, eq(competencies.id, followUps.competencyId))
        .where(
            and(
                eq(followUps.classId, classId),
                followUpId === undefined
                    ? undefined
                    : eq(followUps.id, followUpId),
            ),
        )
        .orderBy(desc(followUps.createdAt), desc(followUps.id));
}

type Row = Awaited<ReturnType<typeof followUpRows>>[number];

async function viewsOf(db: Queryable, classId: number, rows: Row[]) {
    const named =
        rows.length === 0
            ? []
            : await db
                  .select({
                      followUpId: followUpStudents.followUpId,
                      id: users.id,
                      name: users.name,
                  })
                  .from(followUpStudents)
                  .innerJoin(users, eq(users.id, followUpStudents.studentId))
                  .where(
                      inArray(
                          followUpStudents.followUpId,
                          rows.map(({ id }) => id),
                      ),
                  )
                  .orderBy(asc(users.name), asc(users.id));
    const asked = new Map(
        await Promise.all(
            rows.map(
                async (row) =>
                    [
                        row.id,
                        (await questionRows(db, row)).map(({ id }) => id),
                    ] as const,
            ),
        ),
    );
    const blockIds = [...new Set([...asked.values()].flat())];
    const known = new Map(
        await Promise.all(
            [...new Set(named.map(({ id }) => id))].map(async (studentId) => {
                const missions = await missionsOf(
                    db,
                    studentId,
                    undefined,
                    classId,
                );

                return [
                    studentId,
                    {
                        statuses: await shownStatuses(
                            db,
                            missions.map(({ attemptId }) => attemptId),
                        ),
                        tries: await triesOf(db, studentId, blockIds),
                    },
                ] as const;
            }),
        ),
    );

    return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        assignmentId: row.assignmentId,
        mission: row.mission,
        subject: row.subject,
        competency:
            row.competencyId === null || row.code === null
                ? null
                : {
                      id: row.competencyId,
                      code: row.code,
                      description: row.description ?? '',
                  },
        note: row.note,
        createdAt: row.createdAt,
        doneAt: row.doneAt,
        students: named
            .filter(({ followUpId }) => followUpId === row.id)
            .map(({ id, name }) => {
                const student = known.get(id);

                return {
                    id,
                    name,
                    status:
                        row.competencyId === null
                            ? null
                            : (student?.statuses.get(row.competencyId) ?? null),
                    practice: practised(row.kind)
                        ? practiceOf(
                              asked.get(row.id) ?? [],
                              student?.tries ?? [],
                              row.createdAt,
                          )
                        : null,
                };
            }),
    }));
}

async function oneOf(db: Queryable, classId: number, followUpId: number) {
    const [view] = await viewsOf(
        db,
        classId,
        await followUpRows(db, classId, followUpId),
    );

    if (!view) throw notFound('Follow-up not found');

    return view;
}

export async function classFollowUps(
    request: FastifyRequest<{ Params: ClassParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );

    return {
        followUps: await viewsOf(db, classId, await followUpRows(db, classId)),
    };
}

export async function createFollowUp(
    request: FastifyRequest<{ Params: ClassParams; Body: CreateBody }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const teacherId = currentUser(request).id;
    const classId = await ownedClassId(db, request.params.classId, teacherId);
    const { assignmentId, kind, studentIds, note } = request.body;
    const competencyId = request.body.competencyId ?? null;
    const [mission] = await db
        .select({ sessionId: assignments.learningSessionId })
        .from(assignments)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .where(
            and(
                eq(assignments.id, assignmentId),
                eq(assignments.classId, classId),
                eq(learningSessions.status, 'ready'),
            ),
        );

    if (!mission) throw notFound('Assignment not found');

    if (competencyId !== null) {
        const [taught] = await db
            .select({ id: sessionCompetencies.competencyId })
            .from(sessionCompetencies)
            .where(
                and(
                    eq(
                        sessionCompetencies.learningSessionId,
                        mission.sessionId,
                    ),
                    eq(sessionCompetencies.competencyId, competencyId),
                ),
            );

        if (!taught) {
            throw fieldError(
                'competencyId',
                'The mission does not teach this competency',
            );
        }
    }

    const members = new Set((await membersOf(db, classId)).map(({ id }) => id));

    if (studentIds.some((id) => !members.has(id))) {
        throw fieldError('studentIds', 'Choose students of this class');
    }

    if (
        practised(kind) &&
        (
            await questionRows(db, {
                kind,
                sessionId: mission.sessionId,
                competencyId,
            })
        ).length === 0
    ) {
        throw new AppError(
            409,
            kind === 'enrich'
                ? {
                      message: 'The mission has no extra challenge',
                      code: 'NO_EXTRA',
                  }
                : {
                      message: 'The mission has no check on this competency',
                      code: 'NO_QUESTIONS',
                  },
        );
    }

    const followUpId = await db.transaction(async (tx) => {
        const [row] = await tx
            .insert(followUps)
            .values({
                classId,
                teacherId,
                assignmentId,
                competencyId,
                kind,
                note: note || null,
            })
            .returning({ id: followUps.id });

        await tx.insert(followUpStudents).values(
            studentIds.map((studentId) => ({
                followUpId: row.id,
                studentId,
            })),
        );

        return row.id;
    });

    return reply
        .code(201)
        .send({ followUp: await oneOf(db, classId, followUpId) });
}

export async function markFollowUp(
    request: FastifyRequest<{ Params: FollowUpParams; Body: DoneBody }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );
    const [row] = await db
        .update(followUps)
        .set({ doneAt: request.body.done ? new Date() : null })
        .where(
            and(
                eq(followUps.id, request.params.followUpId),
                eq(followUps.classId, classId),
            ),
        )
        .returning({ id: followUps.id });

    if (!row) throw notFound('Follow-up not found');

    return { followUp: await oneOf(db, classId, row.id) };
}

async function offeredTo(
    db: Queryable,
    studentId: number,
    only: { subject?: Subject; followUpId?: number },
) {
    const [member] = await db
        .select({ classId: classMembers.classId })
        .from(classMembers)
        .where(eq(classMembers.studentId, studentId));
    const missions = member
        ? await missionsOf(db, studentId, only.subject, member.classId)
        : [];

    if (!member || missions.length === 0) return [];

    const rows = await db
        .select({
            id: followUps.id,
            kind: followUps.kind,
            assignmentId: followUps.assignmentId,
            sessionId: assignments.learningSessionId,
            subject: materials.subject,
            competencyId: followUps.competencyId,
            competency: competencies.description,
            note: followUps.note,
            createdAt: followUps.createdAt,
        })
        .from(followUps)
        .innerJoin(
            followUpStudents,
            and(
                eq(followUpStudents.followUpId, followUps.id),
                eq(followUpStudents.studentId, studentId),
            ),
        )
        .innerJoin(assignments, eq(assignments.id, followUps.assignmentId))
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .leftJoin(competencies, eq(competencies.id, followUps.competencyId))
        .where(
            and(
                eq(followUps.classId, member.classId),
                isNull(followUps.doneAt),
                inArray(followUps.kind, ['reinforce', 'enrich']),
                inArray(
                    followUps.assignmentId,
                    missions.map(({ assignmentId }) => assignmentId),
                ),
                only.followUpId === undefined
                    ? undefined
                    : eq(followUps.id, only.followUpId),
            ),
        )
        .orderBy(desc(followUps.createdAt), desc(followUps.id));
    const offered = [];

    for (const row of rows) {
        const mission = missions.find(
            ({ assignmentId }) => assignmentId === row.assignmentId,
        );
        const blocks = await questionRows(db, row);
        const tries = await triesOf(
            db,
            studentId,
            blocks.map(({ id }) => id),
        );
        const practice = practiceOf(
            blocks.map(({ id }) => id),
            tries,
            row.createdAt,
        );

        if (!mission || practice.done === practice.total) continue;

        offered.push({ row, mission, blocks, tries, practice });
    }

    return offered;
}

type Offered = Awaited<ReturnType<typeof offeredTo>>[number];

const summaryOf = ({ row, mission }: Offered) => ({
    id: row.id,
    kind: row.kind,
    mission: mission.title,
    competency: row.competency,
    note: row.note,
});

async function askedBlock(
    db: Queryable,
    found: Offered,
    row: Offered['blocks'][number],
) {
    const themed = themedBlock(
        row,
        await themesFor(db, [{ blockId: row.id, theme: found.mission.theme }]),
    );
    const block = themed.kind === 'extra_challenge' ? asCheck(themed) : themed;

    return block.kind === 'check'
        ? { ...block, id: row.id, position: row.position }
        : null;
}

export async function myFollowUps(
    request: FastifyRequest<{ Querystring: StudentFollowUpsQuery }>,
) {
    const offered = await offeredTo(
        request.server.db,
        currentUser(request).id,
        { subject: request.query.subject },
    );

    return {
        followUps: offered.map((found) => ({
            ...summaryOf(found),
            practice: found.practice,
        })),
    };
}

export async function myFollowUp(
    request: FastifyRequest<{ Params: StudentFollowUpParams }>,
) {
    const { db } = request.server;
    const [found] = await offeredTo(db, currentUser(request).id, {
        followUpId: request.params.followUpId,
    });

    if (!found) throw notFound('Follow-up not found');

    const questions = [];

    const finished = closedSince(
        found.blocks.map(({ id }) => id),
        found.tries,
        found.row.createdAt,
    ).map(({ blockId }) => blockId);

    for (const row of found.blocks.filter(({ id }) => !finished.includes(id))) {
        const block = await askedBlock(db, found, row);
        const round = roundOf(
            found.tries.filter(({ blockId }) => blockId === row.id),
        );

        if (block) {
            questions.push({
                id: row.id,
                mission: found.mission.title,
                content: block.content,
                earned: earnedOf(block, practiceHistoryOf(round)),
                tries: round.length,
            });
        }
    }

    return {
        followUp: { ...summaryOf(found), subject: found.row.subject },
        questions,
    };
}

export async function answerFollowUp(
    request: FastifyRequest<{
        Params: StudentFollowUpParams;
        Body: ReviewTryBody;
    }>,
    reply: FastifyReply,
) {
    const studentId = currentUser(request).id;
    const given = request.body;

    return reply.code(201).send(
        await request.server.db.transaction(async (tx) => {
            await lockTries(tx, studentId, given.blockId);

            const [found] = await offeredTo(tx, studentId, {
                followUpId: request.params.followUpId,
            });
            const row = found?.blocks.find(({ id }) => id === given.blockId);
            const block = found && row && (await askedBlock(tx, found, row));

            if (!found || !block) throw notFound('Question not found');

            const history = practiceHistoryOf(
                roundOf(
                    found.tries.filter(({ blockId }) => blockId === block.id),
                ),
            );

            if (given.tryNumber !== history.answers.length + 1) {
                throw fieldError(
                    'tryNumber',
                    `The next try is number ${history.answers.length + 1}`,
                );
            }

            const outcome = judge(block, given.answer);
            const help = followUp(block, history, given.tryNumber, outcome);

            await tx.insert(reviewTries).values({
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
        }),
    );
}

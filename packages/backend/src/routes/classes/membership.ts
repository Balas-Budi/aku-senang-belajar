import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    attempts,
    classes,
    classMembers,
    membershipEvents,
    pastMemberships,
    users,
} from '../../db/schema.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { membersOf, ownedClassId } from './queries.ts';
import type { ClassParams, MemberParams, MembershipBody } from './schema.ts';

type End = typeof pastMemberships.$inferSelect.reason;

const EVENTS = 200;
const actors = alias(users, 'actors');
const others = alias(classes, 'others');

export async function startMembership(
    tx: Queryable,
    studentId: number,
    classId: number,
    actorId: number,
) {
    await tx.insert(classMembers).values({ studentId, classId });
    await tx
        .insert(membershipEvents)
        .values({ studentId, classId, actorId, action: 'joined' });
}

export async function endMembership(
    tx: Queryable,
    studentId: number,
    actorId: number,
    reason: End,
    otherClassId: number | null = null,
) {
    const [ended] = await tx
        .delete(classMembers)
        .where(eq(classMembers.studentId, studentId))
        .returning({
            classId: classMembers.classId,
            joinedAt: classMembers.joinedAt,
        });

    if (!ended) return null;

    await tx.insert(pastMemberships).values({
        studentId,
        classId: ended.classId,
        joinedAt: ended.joinedAt,
        reason,
    });
    await tx.insert(membershipEvents).values({
        studentId,
        classId: ended.classId,
        otherClassId,
        actorId,
        action: reason,
    });

    return ended;
}

export async function moveMembership(
    tx: Queryable,
    studentId: number,
    classId: number,
    actorId: number,
) {
    const [current] = await tx
        .select({ classId: classMembers.classId })
        .from(classMembers)
        .where(eq(classMembers.studentId, studentId))
        .for('update');

    if (current?.classId === classId) return;

    if (!current) {
        await startMembership(tx, studentId, classId, actorId);
        return;
    }

    await endMembership(tx, studentId, actorId, 'moved', classId);
    await tx.insert(classMembers).values({ studentId, classId });
}

export async function rosterOf(db: Queryable, classId: number) {
    return (await membersOf(db, classId)).map(({ inactiveAt, ...student }) => ({
        ...student,
        inactive: inactiveAt !== null,
    }));
}

export async function pastMembersOf(db: Queryable, classId: number) {
    const rows = await db
        .select({
            studentId: pastMemberships.studentId,
            name: users.name,
            joinedAt: pastMemberships.joinedAt,
            endedAt: pastMemberships.endedAt,
            reason: pastMemberships.reason,
        })
        .from(pastMemberships)
        .innerJoin(users, eq(users.id, pastMemberships.studentId))
        .where(
            and(eq(pastMemberships.classId, classId), isNull(users.deletedAt)),
        )
        .orderBy(desc(pastMemberships.endedAt), desc(pastMemberships.id));
    const current = new Set((await membersOf(db, classId)).map(({ id }) => id));

    return rows.filter(
        ({ studentId }, index) =>
            !current.has(studentId) &&
            rows.findIndex((row) => row.studentId === studentId) === index,
    );
}

export async function changeMembership(
    request: FastifyRequest<{ Params: MemberParams; Body: MembershipBody }>,
) {
    const { db } = request.server;
    const teacherId = currentUser(request).id;
    const classId = await ownedClassId(db, request.params.classId, teacherId);
    const { studentId } = request.params;
    const { action } = request.body;

    await db.transaction(async (tx) => {
        const [member] = await tx
            .select({ inactiveAt: classMembers.inactiveAt })
            .from(classMembers)
            .where(
                and(
                    eq(classMembers.studentId, studentId),
                    eq(classMembers.classId, classId),
                ),
            )
            .for('update');

        if (!member) throw notFound('Student not found');

        if (action === 'archive') {
            await endMembership(tx, studentId, teacherId, 'archived');
            return;
        }

        if (action === 'move') {
            const [target] = await tx
                .select({ id: classes.id })
                .from(classes)
                .where(
                    and(
                        eq(classes.id, request.body.classId ?? 0),
                        eq(classes.teacherId, teacherId),
                    ),
                );

            if (!target || target.id === classId) {
                throw fieldError('classId', 'Choose another class of your own');
            }

            await moveMembership(tx, studentId, target.id, teacherId);
            return;
        }

        if ((action === 'deactivate') === (member.inactiveAt !== null)) {
            throw new AppError(409, {
                message:
                    action === 'deactivate'
                        ? 'The membership is already inactive'
                        : 'The membership is active',
                code: 'MEMBERSHIP_STATE',
            });
        }

        await tx
            .update(classMembers)
            .set({ inactiveAt: action === 'deactivate' ? new Date() : null })
            .where(eq(classMembers.studentId, studentId));
        await tx.insert(membershipEvents).values({
            studentId,
            classId,
            actorId: teacherId,
            action: action === 'deactivate' ? 'deactivated' : 'reactivated',
        });
    });

    return { students: await rosterOf(db, classId) };
}

export async function membershipHistory(
    request: FastifyRequest<{ Params: ClassParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );
    const events = await db
        .select({
            id: membershipEvents.id,
            action: membershipEvents.action,
            classId: membershipEvents.classId,
            studentId: users.id,
            studentName: users.name,
            actor: actors.role,
            from: classes.name,
            to: others.name,
            createdAt: membershipEvents.createdAt,
        })
        .from(membershipEvents)
        .innerJoin(users, eq(users.id, membershipEvents.studentId))
        .innerJoin(classes, eq(classes.id, membershipEvents.classId))
        .leftJoin(actors, eq(actors.id, membershipEvents.actorId))
        .leftJoin(others, eq(others.id, membershipEvents.otherClassId))
        .where(
            or(
                eq(membershipEvents.classId, classId),
                eq(membershipEvents.otherClassId, classId),
            ),
        )
        .orderBy(desc(membershipEvents.createdAt), desc(membershipEvents.id))
        .limit(EVENTS);
    const past = await pastMembersOf(db, classId);
    const submitted =
        past.length === 0
            ? []
            : await db
                  .select({ studentId: attempts.studentId, total: count() })
                  .from(attempts)
                  .innerJoin(
                      assignments,
                      eq(assignments.id, attempts.assignmentId),
                  )
                  .where(
                      and(
                          eq(assignments.classId, classId),
                          eq(attempts.status, 'submitted'),
                          inArray(
                              attempts.studentId,
                              past.map(({ studentId }) => studentId),
                          ),
                      ),
                  )
                  .groupBy(attempts.studentId);

    return {
        events: events.map((event) => {
            const here = event.classId === classId;

            return {
                id: event.id,
                action: event.action,
                student: { id: event.studentId, name: event.studentName },
                actor: event.actor,
                otherClass:
                    event.action === 'moved'
                        ? here
                            ? event.to
                            : event.from
                        : null,
                direction:
                    event.action === 'moved'
                        ? here
                            ? ('out' as const)
                            : ('in' as const)
                        : null,
                createdAt: event.createdAt,
            };
        }),
        past: past.map((member) => ({
            ...member,
            submitted:
                submitted.find(
                    ({ studentId }) => studentId === member.studentId,
                )?.total ?? 0,
        })),
    };
}

import { and, asc, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Queryable } from '../../db/index.ts';
import { classes, classMembers, users } from '../../db/schema.ts';
import { notFound } from '../../lib/errors.ts';

const teachers = alias(users, 'teachers');

export async function classroomOf(db: Queryable, studentId: number) {
    const [classroom] = await db
        .select({
            id: classes.id,
            name: classes.name,
            teacherName: teachers.name,
            inactiveAt: classMembers.inactiveAt,
        })
        .from(classMembers)
        .innerJoin(classes, eq(classes.id, classMembers.classId))
        .innerJoin(teachers, eq(teachers.id, classes.teacherId))
        .where(eq(classMembers.studentId, studentId))
        .limit(1);

    if (!classroom) return null;

    const { inactiveAt, ...rest } = classroom;

    return { ...rest, inactive: inactiveAt !== null };
}

export async function ownedClassId(
    db: Queryable,
    classId: number,
    teacherId: number,
): Promise<number> {
    const [classroom] = await db
        .select({ id: classes.id })
        .from(classes)
        .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
        .limit(1);

    if (!classroom) {
        throw notFound('Class not found');
    }

    return classroom.id;
}

export function membersOf(db: Queryable, classId: number) {
    return db
        .select({
            id: users.id,
            name: users.name,
            joinedAt: classMembers.joinedAt,
            inactiveAt: classMembers.inactiveAt,
        })
        .from(classMembers)
        .innerJoin(users, eq(users.id, classMembers.studentId))
        .where(and(eq(classMembers.classId, classId), isNull(users.deletedAt)))
        .orderBy(asc(users.name), asc(users.id));
}

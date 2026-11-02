import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Queryable } from '../../db/index.ts';
import { classes, classMembers, users } from '../../db/schema.ts';

const teachers = alias(users, 'teachers');

export async function classroomOf(db: Queryable, studentId: number) {
    const [classroom] = await db
        .select({
            id: classes.id,
            name: classes.name,
            teacherName: teachers.name,
        })
        .from(classMembers)
        .innerJoin(classes, eq(classes.id, classMembers.classId))
        .innerJoin(teachers, eq(teachers.id, classes.teacherId))
        .where(eq(classMembers.studentId, studentId))
        .limit(1);

    return classroom ?? null;
}

import { and, asc, count, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { generatePassword } from '../../auth/codes.ts';
import { hashPassword } from '../../auth/password.ts';
import { deleteUserSessions } from '../../auth/sessions.ts';
import type { Queryable } from '../../db/index.ts';
import {
    analysisRuns,
    attempts,
    classes,
    classMembers,
    learnerAdaptations,
    learnerSummaries,
    reports,
    users,
} from '../../db/schema.ts';
import { AppError } from '../../lib/errors.ts';
import { fieldError, validationError } from '../../lib/field-error.ts';
import { isUniqueViolation } from '../../lib/unique-violation.ts';
import { classroomOf } from '../classes/queries.ts';
import {
    GENERATED_PASSWORD_LENGTH,
    importUsersBody,
    MAX_IMPORT_ROWS,
    type CreateUserBody,
    type ImportFileQuery,
    type ImportUsersBody,
    type ListUsersQuery,
    type ManagedRole,
    type MoveStudentBody,
    type StudentParams,
    type UserParams,
} from './schema.ts';
import { readUserRows, XLSX_CONTENT_TYPE } from './spreadsheet.ts';

type UserRow = { name: string; username: string; password?: string };

const teachers = alias(users, 'teachers');

function usernamesTaken(fields: string[]): AppError {
    return new AppError(409, {
        message: 'Some usernames are already taken',
        code: 'ALREADY_EXISTS',
        context: {
            public: fields.map((field) => ({
                field,
                message: 'Username is already taken',
            })),
        },
    });
}

async function createUsers(
    db: Queryable,
    role: ManagedRole,
    rows: UserRow[],
    fieldOf: (index: number) => string,
) {
    const taken = await db
        .select({ username: users.username })
        .from(users)
        .where(
            inArray(
                users.username,
                rows.map((row) => row.username),
            ),
        );
    const takenSet = new Set(taken.map((row) => row.username));

    if (takenSet.size > 0) {
        throw usernamesTaken(
            rows.flatMap((row, index) =>
                takenSet.has(row.username) ? [fieldOf(index)] : [],
            ),
        );
    }

    const prepared = await Promise.all(
        rows.map(async (row) => {
            const password =
                row.password ??
                generatePassword(GENERATED_PASSWORD_LENGTH[role]);

            return {
                row,
                generatedPassword: row.password ? null : password,
                passwordHash: await hashPassword(password),
            };
        }),
    );

    const inserted = await db
        .insert(users)
        .values(
            prepared.map(({ row, passwordHash }) => ({
                role,
                name: row.name,
                username: row.username,
                passwordHash,
            })),
        )
        .returning({ id: users.id, name: users.name, username: users.username })
        .catch((error: unknown) => {
            throw isUniqueViolation(error)
                ? usernamesTaken(rows.map((_, index) => fieldOf(index)))
                : error;
        });

    return inserted.map((user, index) => ({
        ...user,
        role,
        generatedPassword: prepared[index].generatedPassword,
    }));
}

async function managedUser(
    db: Queryable,
    userId: number,
    only?: ManagedRole,
): Promise<{ id: number; role: ManagedRole }> {
    const [user] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);

    if (!user || user.role === 'admin' || (only && user.role !== only)) {
        throw new AppError(404, {
            message: 'User not found',
            code: 'NOT_FOUND',
        });
    }

    return { id: user.id, role: user.role };
}

function importInTransaction(request: FastifyRequest, body: ImportUsersBody) {
    return request.server.db.transaction((tx) =>
        createUsers(
            tx,
            body.role,
            body.users,
            (index) => `users/${index}/username`,
        ),
    );
}

export async function createUser(
    request: FastifyRequest<{ Body: CreateUserBody }>,
    reply: FastifyReply,
) {
    const { role, ...row } = request.body;
    const [user] = await createUsers(
        request.server.db,
        role,
        [row],
        () => 'username',
    );

    return reply.code(201).send(user);
}

export async function importUsers(
    request: FastifyRequest<{ Body: ImportUsersBody }>,
    reply: FastifyReply,
) {
    return reply
        .code(201)
        .send({ created: await importInTransaction(request, request.body) });
}

export async function importUsersFile(
    request: FastifyRequest<{ Querystring: ImportFileQuery }>,
    reply: FastifyReply,
) {
    if (!Buffer.isBuffer(request.body)) {
        throw fieldError(
            'file',
            `Send the spreadsheet as ${XLSX_CONTENT_TYPE}`,
        );
    }

    const rows = await readUserRows(request.body);

    if (rows.length === 0 || rows.length > MAX_IMPORT_ROWS) {
        throw validationError([
            {
                field: 'file',
                message: `The sheet needs 1 to ${MAX_IMPORT_ROWS} rows of users`,
            },
        ]);
    }

    const parsed = importUsersBody.safeParse({
        role: request.query.role,
        users: rows,
    });

    if (!parsed.success) {
        throw validationError(
            parsed.error.issues.map((issue) => ({
                field: issue.path.join('/'),
                message: issue.message,
            })),
        );
    }

    return reply
        .code(201)
        .send({ created: await importInTransaction(request, parsed.data) });
}

export async function listUsers(
    request: FastifyRequest<{ Querystring: ListUsersQuery }>,
) {
    const { role } = request.query;
    const rows = await request.server.db
        .select({
            id: users.id,
            name: users.name,
            username: users.username,
            classId: classes.id,
            className: classes.name,
            teacherName: teachers.name,
        })
        .from(users)
        .leftJoin(classMembers, eq(classMembers.studentId, users.id))
        .leftJoin(classes, eq(classes.id, classMembers.classId))
        .leftJoin(teachers, eq(teachers.id, classes.teacherId))
        .where(and(eq(users.role, role), isNull(users.deletedAt)))
        .orderBy(asc(users.name), asc(users.id));

    return rows.map((row) => ({
        id: row.id,
        role,
        name: row.name,
        username: row.username,
        classroom:
            row.classId !== null &&
            row.className !== null &&
            row.teacherName !== null
                ? {
                      id: row.classId,
                      name: row.className,
                      teacherName: row.teacherName,
                  }
                : null,
    }));
}

export async function listClasses(request: FastifyRequest) {
    return request.server.db
        .select({
            id: classes.id,
            name: classes.name,
            teacherName: teachers.name,
            studentCount: count(classMembers.studentId),
        })
        .from(classes)
        .innerJoin(teachers, eq(teachers.id, classes.teacherId))
        .leftJoin(classMembers, eq(classMembers.classId, classes.id))
        .groupBy(classes.id, teachers.name)
        .orderBy(asc(classes.name), asc(classes.id));
}

export async function moveStudent(
    request: FastifyRequest<{ Params: StudentParams; Body: MoveStudentBody }>,
) {
    const { db } = request.server;
    const student = await managedUser(db, request.params.studentId, 'student');
    const { classId } = request.body;

    if (classId !== null) {
        const [target] = await db
            .select({ id: classes.id })
            .from(classes)
            .where(eq(classes.id, classId))
            .limit(1);

        if (!target) {
            throw new AppError(404, {
                message: 'Class not found',
                code: 'NOT_FOUND',
            });
        }
    }

    await db.transaction(async (tx) => {
        await tx
            .delete(classMembers)
            .where(eq(classMembers.studentId, student.id));

        if (classId !== null) {
            await tx
                .insert(classMembers)
                .values({ studentId: student.id, classId });
        }
    });

    return { classroom: await classroomOf(db, student.id) };
}

export async function deleteMemory(
    request: FastifyRequest<{ Params: StudentParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const student = await managedUser(db, request.params.studentId, 'student');

    await db.transaction(async (tx) => {
        await tx
            .update(attempts)
            .set({ memoryDeletedAt: new Date() })
            .where(eq(attempts.studentId, student.id));
        await tx
            .delete(learnerSummaries)
            .where(
                inArray(
                    learnerSummaries.runId,
                    tx
                        .select({ id: analysisRuns.id })
                        .from(analysisRuns)
                        .innerJoin(
                            attempts,
                            eq(attempts.id, analysisRuns.attemptId),
                        )
                        .where(eq(attempts.studentId, student.id)),
                ),
            );
        await tx.delete(reports).where(eq(reports.studentId, student.id));
        await tx
            .delete(learnerAdaptations)
            .where(eq(learnerAdaptations.studentId, student.id));
        await tx
            .update(attempts)
            .set({ adaptation: null })
            .where(
                and(
                    eq(attempts.studentId, student.id),
                    isNotNull(attempts.adaptation),
                ),
            );
    });

    return reply.code(204).send();
}

export async function resetPassword(
    request: FastifyRequest<{ Params: UserParams }>,
) {
    const { db } = request.server;
    const user = await managedUser(db, request.params.userId);
    const password = generatePassword(GENERATED_PASSWORD_LENGTH[user.role]);
    const passwordHash = await hashPassword(password);

    await db.transaction(async (tx) => {
        await tx
            .update(users)
            .set({ passwordHash })
            .where(eq(users.id, user.id));
        await deleteUserSessions(tx, user.id);
    });

    return { password };
}

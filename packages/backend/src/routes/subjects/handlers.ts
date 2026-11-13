import { asc, count, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import { learnerAdaptations, materials, subjects } from '../../db/schema.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { isUniqueViolation } from '../../lib/unique-violation.ts';
import { BUILT_IN_SUBJECTS, sameName, slugOf } from '../../subjects.ts';
import type { SubjectBody, SubjectParams } from './schema.ts';

const taken = () =>
    new AppError(409, {
        message: 'A subject with this name already exists',
        code: 'SUBJECT_EXISTS',
    });

export async function listSubjects(request: FastifyRequest) {
    const rows = await request.server.db
        .select({
            key: subjects.key,
            name: subjects.name,
            color: subjects.color,
            icon: subjects.icon,
            createdBy: subjects.createdBy,
            createdAt: subjects.createdAt,
            books: count(materials.id),
        })
        .from(subjects)
        .leftJoin(materials, eq(materials.subject, subjects.key))
        .groupBy(subjects.key)
        .orderBy(asc(subjects.position));
    const staff = currentUser(request).role !== 'student';
    return rows.map(({ createdBy: _, createdAt: __, books, ...row }) => ({
        ...row,
        builtIn: (BUILT_IN_SUBJECTS as readonly string[]).includes(row.key),
        books: staff ? books : 0,
    }));
}

export async function createSubject(
    request: FastifyRequest<{ Body: SubjectBody }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const { name, color, icon } = request.body;
    const [same] = await db
        .select({ key: subjects.key })
        .from(subjects)
        .where(sameName(name));
    if (same) throw taken();

    const base = slugOf(name);
    const keys = new Set(
        (await db.select({ key: subjects.key }).from(subjects)).map(
            ({ key }) => key,
        ),
    );
    let key = base;
    for (let n = 2; keys.has(key); n++) key = `${base}-${n}`;

    try {
        const [row] = await db
            .insert(subjects)
            .values({
                key,
                name,
                color,
                icon,
                createdBy: currentUser(request).id,
            })
            .returning({
                key: subjects.key,
                name: subjects.name,
                color: subjects.color,
                icon: subjects.icon,
            });
        return reply.code(201).send({ ...row, builtIn: false, books: 0 });
    } catch (error) {
        if (isUniqueViolation(error)) throw taken();
        throw error;
    }
}

export async function deleteSubject(
    request: FastifyRequest<{ Params: SubjectParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const { key } = request.params;
    await db.transaction(async (tx) => {
        const [row] = await tx
            .select({ key: subjects.key })
            .from(subjects)
            .where(eq(subjects.key, key))
            .for('update');
        if (!row) throw notFound('Subject not found');

        const [{ books }] = await tx
            .select({ books: count() })
            .from(materials)
            .where(eq(materials.subject, key));
        const [{ notes }] = await tx
            .select({ notes: count() })
            .from(learnerAdaptations)
            .where(eq(learnerAdaptations.subject, key));
        if (books > 0 || notes > 0)
            throw new AppError(409, {
                message: 'The subject is still in use',
                code: 'SUBJECT_IN_USE',
                context: { public: { books, notes } },
            });

        await tx.delete(subjects).where(eq(subjects.key, key));
    });
    return reply.code(204).send();
}

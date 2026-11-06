import { and, asc, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    learningSessions,
    materialPages,
    materials,
    modules,
} from '../../db/schema.ts';
import { notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { readPdfPages } from './pdf.ts';
import type { MaterialParams, PageParams, UploadQuery } from './schema.ts';

const SNIPPET_LENGTH = 160;

const visibleTo = (userId: number) =>
    or(isNull(materials.ownerId), eq(materials.ownerId, userId));

const summary = {
    id: materials.id,
    title: materials.title,
    subject: materials.subject,
    grade: materials.grade,
    ownerId: materials.ownerId,
    pageCount: count(materialPages.number),
    readablePages: count(materialPages.text),
};

function withPrepared<T extends { ownerId: number | null }>({
    ownerId,
    ...row
}: T) {
    return { ...row, prepared: ownerId === null };
}

async function materialDetail(
    db: Queryable,
    materialId: number,
    userId: number,
) {
    const [material] = await db
        .select(summary)
        .from(materials)
        .leftJoin(materialPages, eq(materialPages.materialId, materials.id))
        .where(and(eq(materials.id, materialId), visibleTo(userId)))
        .groupBy(materials.id);

    if (!material) {
        throw notFound('Material not found');
    }

    const pages = await db
        .select({
            number: materialPages.number,
            snippet: sql<
                string | null
            >`left(${materialPages.text}, ${SNIPPET_LENGTH})`,
        })
        .from(materialPages)
        .where(eq(materialPages.materialId, materialId))
        .orderBy(asc(materialPages.number));
    const rows = await db
        .select({
            id: modules.id,
            title: modules.title,
            session: {
                id: learningSessions.id,
                title: learningSessions.title,
                status: learningSessions.status,
            },
        })
        .from(modules)
        .leftJoin(learningSessions, eq(learningSessions.moduleId, modules.id))
        .where(eq(modules.materialId, materialId))
        .orderBy(asc(modules.id), asc(learningSessions.id));
    const byModule = new Map<
        number,
        {
            id: number;
            title: string;
            sessions: NonNullable<(typeof rows)[number]['session']>[];
        }
    >();

    for (const { id, title, session } of rows) {
        const entry = byModule.get(id) ?? { id, title, sessions: [] };
        if (session) entry.sessions.push(session);
        byModule.set(id, entry);
    }

    return {
        ...withPrepared(material),
        pages: pages.map(({ number, snippet }) => ({
            number,
            readable: snippet !== null,
            snippet,
        })),
        modules: [...byModule.values()],
    };
}

export async function listMaterials(request: FastifyRequest) {
    const user = currentUser(request);
    const rows = await request.server.db
        .select(summary)
        .from(materials)
        .leftJoin(materialPages, eq(materialPages.materialId, materials.id))
        .where(visibleTo(user.id))
        .groupBy(materials.id)
        .orderBy(
            sql`${materials.ownerId} is not null`,
            desc(materials.createdAt),
            desc(materials.id),
        );

    return rows.map(withPrepared);
}

export async function uploadMaterial(
    request: FastifyRequest<{ Querystring: UploadQuery }>,
    reply: FastifyReply,
) {
    const user = currentUser(request);

    if (!Buffer.isBuffer(request.body)) {
        throw fieldError('pdf', 'Send the material as application/pdf');
    }

    const pages = await readPdfPages(request.body);

    if (pages.every((text) => text === null)) {
        throw fieldError('pdf', 'None of the pages has text that can be read');
    }

    const { title, subject, grade } = request.query;
    const materialId = await request.server.db.transaction(async (tx) => {
        const [material] = await tx
            .insert(materials)
            .values({
                title,
                subject,
                grade,
                ownerId: user.id,
                rightsConfirmedAt: new Date(),
            })
            .returning({ id: materials.id });

        await tx.insert(materialPages).values(
            pages.map((text, index) => ({
                materialId: material.id,
                number: index + 1,
                text,
            })),
        );

        return material.id;
    });

    return reply
        .code(201)
        .send(await materialDetail(request.server.db, materialId, user.id));
}

export async function getMaterial(
    request: FastifyRequest<{ Params: MaterialParams }>,
) {
    return materialDetail(
        request.server.db,
        request.params.materialId,
        currentUser(request).id,
    );
}

export async function getPage(request: FastifyRequest<{ Params: PageParams }>) {
    const { materialId, number } = request.params;
    const [page] = await request.server.db
        .select({ number: materialPages.number, text: materialPages.text })
        .from(materialPages)
        .innerJoin(materials, eq(materials.id, materialPages.materialId))
        .where(
            and(
                eq(materialPages.materialId, materialId),
                eq(materialPages.number, number),
                visibleTo(currentUser(request).id),
            ),
        );

    if (!page) {
        throw notFound('Page not found');
    }

    return page;
}

import {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    inArray,
    isNull,
    lte,
    max,
    or,
    sql,
} from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AiError, aiConfig, chatJson } from '../../ai/chat.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    competencies,
    learningSessions,
    materialChunks,
    materialPages,
    materials,
    materialVersions,
    modules,
    sessionCompetencies,
} from '../../db/schema.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { chunkPages } from '../../materials/chunks.ts';
import {
    checkProposal,
    competencyMessage,
    competencyProposal,
    COMPETENCY_PROMPT_VERSION,
    COMPETENCY_SYSTEM_PROMPT,
} from '../../studio/competencies.ts';
import { visibleTo as sessionVisibleTo } from '../studio/handlers.ts';
import { readPdfPages } from './pdf.ts';
import type {
    MaterialBody,
    MaterialParams,
    ModuleBody,
    PageParams,
    PageQuery,
    PageRange,
    UploadQuery,
} from './schema.ts';

const SNIPPET_LENGTH = 160;
const MAX_MODULE_PAGES = 20;
const AI_TIMEOUT_MS = 90_000;

export const visibleTo = (userId: number) =>
    or(isNull(materials.ownerId), eq(materials.ownerId, userId));

const summary = {
    id: materials.id,
    title: materials.title,
    subject: materials.subject,
    grade: materials.grade,
    ownerId: materials.ownerId,
    version: materials.version,
    archivedAt: materials.archivedAt,
    source: materials.source,
    licence: materials.licence,
    licenceNote: materials.licenceNote,
    pageCount: count(materialPages.number),
    readablePages: count(materialPages.text),
};

const activePages = and(
    eq(materialPages.materialId, materials.id),
    eq(materialPages.version, materials.version),
);

const archived = () =>
    new AppError(409, {
        message: 'The material is archived',
        code: 'MATERIAL_ARCHIVED',
    });

function withPrepared<
    T extends { ownerId: number | null; archivedAt: Date | null },
>({ ownerId, archivedAt, ...row }: T) {
    return {
        ...row,
        prepared: ownerId === null,
        archived: archivedAt !== null,
    };
}

async function materialDetail(
    db: Queryable,
    materialId: number,
    userId: number,
) {
    const [material] = await db
        .select(summary)
        .from(materials)
        .leftJoin(materialPages, activePages)
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
        .where(
            and(
                eq(materialPages.materialId, materialId),
                eq(materialPages.version, material.version),
            ),
        )
        .orderBy(asc(materialPages.number));
    const versionRows = await db
        .select({
            version: materialVersions.version,
            createdAt: materialVersions.createdAt,
            pageCount: count(materialPages.number),
            readablePages: count(materialPages.text),
        })
        .from(materialVersions)
        .leftJoin(
            materialPages,
            and(
                eq(materialPages.materialId, materialVersions.materialId),
                eq(materialPages.version, materialVersions.version),
            ),
        )
        .where(eq(materialVersions.materialId, materialId))
        .groupBy(materialVersions.materialId, materialVersions.version)
        .orderBy(asc(materialVersions.version));
    const moduleRows = await db
        .select({
            id: modules.id,
            title: modules.title,
            firstPage: modules.firstPage,
            lastPage: modules.lastPage,
            version: modules.materialVersion,
        })
        .from(modules)
        .where(eq(modules.materialId, materialId))
        .orderBy(asc(modules.id));
    const moduleIds = moduleRows.map(({ id }) => id);
    const competencyRows =
        moduleIds.length === 0
            ? []
            : await db
                  .select({
                      id: competencies.id,
                      moduleId: competencies.moduleId,
                      code: competencies.code,
                      description: competencies.description,
                      pages: competencies.pages,
                  })
                  .from(competencies)
                  .where(inArray(competencies.moduleId, moduleIds))
                  .orderBy(asc(competencies.id));
    const sessionRows =
        moduleIds.length === 0
            ? []
            : await db
                  .select({
                      id: learningSessions.id,
                      moduleId: learningSessions.moduleId,
                      title: learningSessions.title,
                      status: learningSessions.status,
                      drafting: learningSessions.drafting,
                  })
                  .from(learningSessions)
                  .where(
                      and(
                          inArray(learningSessions.moduleId, moduleIds),
                          sessionVisibleTo(userId),
                      ),
                  )
                  .orderBy(asc(learningSessions.id));
    const taught =
        sessionRows.length === 0
            ? []
            : await db
                  .select({
                      sessionId: sessionCompetencies.learningSessionId,
                      code: competencies.code,
                  })
                  .from(sessionCompetencies)
                  .innerJoin(
                      competencies,
                      eq(competencies.id, sessionCompetencies.competencyId),
                  )
                  .where(
                      inArray(
                          sessionCompetencies.learningSessionId,
                          sessionRows.map(({ id }) => id),
                      ),
                  )
                  .orderBy(asc(competencies.id));

    return {
        ...withPrepared(material),
        pages: pages.map(({ number, snippet }) => ({
            number,
            readable: snippet !== null,
            snippet,
        })),
        versions: versionRows.map((row) => ({
            ...row,
            chapters: moduleRows.filter(
                ({ version }) => version === row.version,
            ).length,
        })),
        modules: moduleRows.map((module) => ({
            ...module,
            competencies: competencyRows
                .filter(({ moduleId }) => moduleId === module.id)
                .map(({ moduleId: _, ...competency }) => competency),
            sessions: sessionRows
                .filter(({ moduleId }) => moduleId === module.id)
                .map(({ moduleId: _, ...session }) => ({
                    ...session,
                    competencies: taught
                        .filter(({ sessionId }) => sessionId === session.id)
                        .map(({ code }) => code),
                })),
        })),
    };
}

async function ownRange(
    db: Queryable,
    materialId: number,
    userId: number,
    { firstPage, lastPage }: PageRange,
) {
    const [material] = await db
        .select({
            subject: materials.subject,
            grade: materials.grade,
            version: materials.version,
            archivedAt: materials.archivedAt,
            pageCount: count(materialPages.number),
        })
        .from(materials)
        .leftJoin(materialPages, activePages)
        .where(and(eq(materials.id, materialId), eq(materials.ownerId, userId)))
        .groupBy(materials.id);

    if (!material) {
        throw notFound('Material not found');
    }

    if (material.archivedAt) throw archived();

    if (lastPage < firstPage) {
        throw fieldError('lastPage', 'The last page comes before the first');
    }

    if (lastPage > material.pageCount) {
        throw fieldError(
            'lastPage',
            `The material has ${material.pageCount} pages`,
        );
    }

    const rows = await db
        .select({ number: materialPages.number, text: materialPages.text })
        .from(materialPages)
        .where(
            and(
                eq(materialPages.materialId, materialId),
                eq(materialPages.version, material.version),
                gte(materialPages.number, firstPage),
                lte(materialPages.number, lastPage),
            ),
        )
        .orderBy(asc(materialPages.number));
    const readable = rows.flatMap(({ number, text }) =>
        text === null ? [] : [{ number, text }],
    );

    if (readable.length === 0) {
        throw fieldError('firstPage', 'The range holds no readable page');
    }

    if (readable.length > MAX_MODULE_PAGES) {
        throw fieldError(
            'lastPage',
            `A module holds at most ${MAX_MODULE_PAGES} readable pages`,
        );
    }

    return { material, readable };
}

export async function draftCompetencies(
    request: FastifyRequest<{ Params: MaterialParams; Body: PageRange }>,
) {
    const { material, readable } = await ownRange(
        request.server.db,
        request.params.materialId,
        currentUser(request).id,
        request.body,
    );
    const config = aiConfig(request.server.env);

    if (!config) {
        throw new AppError(503, {
            message: 'AI is not configured',
            code: 'AI_NOT_CONFIGURED',
        });
    }

    try {
        const { value } = await chatJson(
            config,
            {
                system: COMPETENCY_SYSTEM_PROMPT,
                user: competencyMessage(
                    { ...material, title: request.body.title },
                    readable,
                ),
                schema: competencyProposal,
                check: checkProposal(readable.map(({ number }) => number)),
            },
            AI_TIMEOUT_MS,
        );

        return value;
    } catch (error) {
        if (error instanceof AiError) {
            throw new AppError(502, {
                message: 'AI could not propose competencies',
                code: 'AI_FAILED',
                context: {
                    private: {
                        failure: error.failure,
                        prompt: COMPETENCY_PROMPT_VERSION,
                    },
                },
            });
        }

        throw error;
    }
}

export async function saveModule(
    request: FastifyRequest<{ Params: MaterialParams; Body: ModuleBody }>,
    reply: FastifyReply,
) {
    const { materialId } = request.params;
    const { title, firstPage, lastPage, competencies: list } = request.body;
    const { material, readable } = await ownRange(
        request.server.db,
        materialId,
        currentUser(request).id,
        request.body,
    );
    const readablePages = new Set(readable.map(({ number }) => number));
    const codes = new Set<string>();

    for (const [index, { code, pages }] of list.entries()) {
        if (codes.has(code)) {
            throw fieldError(
                `competencies/${index}/code`,
                'Each competency needs its own code',
            );
        }

        codes.add(code);

        if (pages.some((page) => !readablePages.has(page))) {
            throw fieldError(
                `competencies/${index}/pages`,
                'Pages must be readable pages inside the module',
            );
        }
    }

    const saved = await request.server.db.transaction(async (tx) => {
        const [module] = await tx
            .insert(modules)
            .values({
                materialId,
                title,
                firstPage,
                lastPage,
                materialVersion: material.version,
            })
            .returning({
                id: modules.id,
                title: modules.title,
                firstPage: modules.firstPage,
                lastPage: modules.lastPage,
            });
        const stored = await tx
            .insert(competencies)
            .values(
                list.map((item) => ({
                    moduleId: module.id,
                    code: item.code,
                    description: item.description,
                    pages: [...new Set(item.pages)].sort((a, b) => a - b),
                    rubric: item.rubric,
                })),
            )
            .returning({
                id: competencies.id,
                code: competencies.code,
                description: competencies.description,
                pages: competencies.pages,
            });

        return { ...module, competencies: stored };
    });

    return reply.code(201).send(saved);
}

export async function listMaterials(request: FastifyRequest) {
    const user = currentUser(request);
    const rows = await request.server.db
        .select(summary)
        .from(materials)
        .leftJoin(materialPages, activePages)
        .where(visibleTo(user.id))
        .groupBy(materials.id)
        .orderBy(
            sql`${materials.archivedAt} is not null`,
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
    const pages = await readablePdf(request.body);

    const { title, subject, grade, source, licence, licenceNote } =
        request.query;
    const materialId = await request.server.db.transaction(async (tx) => {
        const [material] = await tx
            .insert(materials)
            .values({
                title,
                subject,
                grade,
                ownerId: user.id,
                rightsConfirmedAt: new Date(),
                source: source || null,
                licence: licence ?? null,
                licenceNote: licenceNote || null,
            })
            .returning({ id: materials.id });

        await storeVersion(tx, material.id, 1, pages);

        return material.id;
    });

    return reply
        .code(201)
        .send(await materialDetail(request.server.db, materialId, user.id));
}

async function readablePdf(body: unknown) {
    if (!Buffer.isBuffer(body)) {
        throw fieldError('pdf', 'Send the material as application/pdf');
    }

    const pages = await readPdfPages(body);

    if (pages.every((text) => text === null)) {
        throw fieldError('pdf', 'None of the pages has text that can be read');
    }

    return pages;
}

async function storeVersion(
    tx: Queryable,
    materialId: number,
    version: number,
    pages: (string | null)[],
) {
    const chunks = await chunkPages(pages);

    await tx.insert(materialVersions).values({ materialId, version });
    await tx.insert(materialPages).values(
        pages.map((text, index) => ({
            materialId,
            version,
            number: index + 1,
            text,
        })),
    );

    if (chunks.length > 0) {
        await tx
            .insert(materialChunks)
            .values(chunks.map((chunk) => ({ ...chunk, materialId, version })));
    }
}

async function ownMaterial(db: Queryable, materialId: number, userId: number) {
    const [material] = await db
        .select({ id: materials.id, archivedAt: materials.archivedAt })
        .from(materials)
        .where(and(eq(materials.id, materialId), eq(materials.ownerId, userId)))
        .for('update');

    if (!material) {
        throw notFound('Material not found');
    }

    return material;
}

export async function uploadVersion(
    request: FastifyRequest<{ Params: MaterialParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const userId = currentUser(request).id;
    const { materialId } = request.params;
    const pages = await readablePdf(request.body);

    await db.transaction(async (tx) => {
        const material = await ownMaterial(tx, materialId, userId);

        if (material.archivedAt) throw archived();

        const [{ last }] = await tx
            .select({ last: max(materialVersions.version) })
            .from(materialVersions)
            .where(eq(materialVersions.materialId, materialId));
        const version = (last ?? 1) + 1;

        if (last === null) {
            await tx
                .insert(materialVersions)
                .values({ materialId, version: 1 });
        }

        await storeVersion(tx, materialId, version, pages);
        await tx
            .update(materials)
            .set({ version })
            .where(eq(materials.id, materialId));
    });

    return reply.code(201).send(await materialDetail(db, materialId, userId));
}

export async function updateMaterial(
    request: FastifyRequest<{ Params: MaterialParams; Body: MaterialBody }>,
) {
    const { db } = request.server;
    const userId = currentUser(request).id;
    const { materialId } = request.params;
    const { archived: archive, version, ...licence } = request.body;

    await db.transaction(async (tx) => {
        await ownMaterial(tx, materialId, userId);

        if (version !== undefined) {
            const [known] = await tx
                .select({ version: materialVersions.version })
                .from(materialVersions)
                .where(
                    and(
                        eq(materialVersions.materialId, materialId),
                        eq(materialVersions.version, version),
                    ),
                );

            if (!known) {
                throw fieldError('version', 'The material has no such version');
            }
        }

        await tx
            .update(materials)
            .set({
                ...licence,
                ...(version === undefined ? {} : { version }),
                ...(archive === undefined
                    ? {}
                    : { archivedAt: archive ? new Date() : null }),
            })
            .where(eq(materials.id, materialId));
    });

    return materialDetail(db, materialId, userId);
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

export async function getPage(
    request: FastifyRequest<{ Params: PageParams; Querystring: PageQuery }>,
) {
    const { materialId, number } = request.params;
    const { version } = request.query;
    const [page] = await request.server.db
        .select({ number: materialPages.number, text: materialPages.text })
        .from(materialPages)
        .innerJoin(materials, eq(materials.id, materialPages.materialId))
        .where(
            and(
                eq(materialPages.materialId, materialId),
                eq(materialPages.number, number),
                version === undefined
                    ? eq(materialPages.version, materials.version)
                    : eq(materialPages.version, version),
                visibleTo(currentUser(request).id),
            ),
        );

    if (!page) {
        throw notFound('Page not found');
    }

    return page;
}

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
import { AiError, aiConfig } from '../../ai/chat.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    competencies,
    learningSessions,
    materialPages,
    materials,
    materialVersions,
    modules,
    sessionCompetencies,
} from '../../db/schema.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError } from '../../lib/field-error.ts';
import { pageContent } from '../../materials/page-content.ts';
import {
    bookOutline,
    MAX_CHAPTER_PAGES,
    readingCounts,
    restartReading,
} from '../../materials/reading.ts';
import { storeModule } from '../../materials/store-module.ts';
import {
    COMPETENCY_PROMPT_VERSION,
    proposeCompetencies,
} from '../../studio/competencies.ts';
import { visibleTo as sessionVisibleTo } from '../studio/handlers.ts';
import { PDF_CONTENT_TYPE, checkPdf } from './pdf.ts';
import type {
    MaterialBody,
    MaterialParams,
    ModuleBody,
    ModuleParams,
    ModuleTitle,
    PageParams,
    PageQuery,
    PageRange,
    UploadQuery,
} from './schema.ts';

const SNIPPET_LENGTH = 160;

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
    readablePages: count(pageContent),
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
            >`left(coalesce(${materialPages.text}, ${materialPages.visual}), ${SNIPPET_LENGTH})`,
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
            readablePages: count(pageContent),
            hasFile: sql<boolean>`${materialVersions.file} is not null`,
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
            madeBy: modules.madeBy,
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
    const [reading] = await db
        .select({
            state: materialVersions.reading,
            error: materialVersions.readingError,
            outline: materialVersions.outline,
            ...readingCounts,
        })
        .from(materialVersions)
        .leftJoin(
            materialPages,
            and(
                eq(materialPages.materialId, materialVersions.materialId),
                eq(materialPages.version, materialVersions.version),
            ),
        )
        .where(
            and(
                eq(materialVersions.materialId, materialId),
                eq(materialVersions.version, material.version),
            ),
        )
        .groupBy(materialVersions.materialId, materialVersions.version);
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

    const outline = bookOutline.safeParse(reading?.outline);

    return {
        ...withPrepared(material),
        reading: {
            state: reading?.state ?? 'done',
            error: reading?.error ?? null,
            pictured: reading?.pictured ?? 0,
            described: reading?.described ?? 0,
            chapters: outline.success ? outline.data.chapters.length : null,
        },
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
        .select({ number: materialPages.number, text: pageContent })
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

    if (lastPage - firstPage + 1 > MAX_CHAPTER_PAGES) {
        throw fieldError(
            'lastPage',
            `A module spans at most ${MAX_CHAPTER_PAGES} pages`,
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
        return await proposeCompetencies(
            config,
            { ...material, title: request.body.title },
            readable,
        );
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

    const saved = await request.server.db.transaction((tx) =>
        storeModule(tx, {
            materialId,
            version: material.version,
            title,
            firstPage,
            lastPage,
            madeBy: 'teacher',
            competencies: list,
        }),
    );

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
    const file = await pdfBody(request.body);

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

        await storeVersion(tx, material.id, 1, file);

        return material.id;
    });

    return reply
        .code(201)
        .send(await materialDetail(request.server.db, materialId, user.id));
}

async function pdfBody(body: unknown) {
    if (!Buffer.isBuffer(body)) {
        throw fieldError('pdf', 'Send the material as application/pdf');
    }

    await checkPdf(body);

    return body;
}

function storeVersion(
    tx: Queryable,
    materialId: number,
    version: number,
    file: Buffer,
) {
    return tx
        .insert(materialVersions)
        .values({ materialId, version, file, reading: 'opening' });
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
    const file = await pdfBody(request.body);

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

        await storeVersion(tx, materialId, version, file);
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
        .select({
            number: materialPages.number,
            text: materialPages.text,
            visual: materialPages.visual,
        })
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

export async function getFile(
    request: FastifyRequest<{ Params: MaterialParams; Querystring: PageQuery }>,
    reply: FastifyReply,
) {
    const { materialId } = request.params;
    const { version } = request.query;
    const [row] = await request.server.db
        .select({ file: materialVersions.file })
        .from(materialVersions)
        .innerJoin(materials, eq(materials.id, materialVersions.materialId))
        .where(
            and(
                eq(materialVersions.materialId, materialId),
                version === undefined
                    ? eq(materialVersions.version, materials.version)
                    : eq(materialVersions.version, version),
                visibleTo(currentUser(request).id),
            ),
        );

    if (!row?.file) {
        throw notFound('File not found');
    }

    return reply
        .header('content-type', PDF_CONTENT_TYPE)
        .header('content-disposition', 'inline')
        .header('cache-control', 'private, max-age=3600')
        .send(row.file);
}

export async function readAgain(
    request: FastifyRequest<{ Params: MaterialParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const { materialId } = request.params;

    const reading = await db.transaction(async (tx) => {
        await ownMaterial(tx, materialId, currentUser(request).id);

        const [material] = await tx
            .select({ version: materials.version })
            .from(materials)
            .where(eq(materials.id, materialId));
        const [restarted] = await restartReading(tx, {
            materialId,
            version: material.version,
        });

        if (!restarted) {
            throw new AppError(409, {
                message: 'The reading has not failed',
                code: 'READING_NOT_FAILED',
            });
        }

        return restarted.reading;
    });

    return reply.code(202).send({ reading });
}

async function ownModule(
    db: Queryable,
    { materialId, moduleId }: ModuleParams,
    userId: number,
) {
    await ownMaterial(db, materialId, userId);

    const [module] = await db
        .select({ id: modules.id })
        .from(modules)
        .where(
            and(eq(modules.id, moduleId), eq(modules.materialId, materialId)),
        );

    if (!module) {
        throw notFound('Module not found');
    }
}

export async function renameModule(
    request: FastifyRequest<{ Params: ModuleParams; Body: ModuleTitle }>,
) {
    const { db } = request.server;
    const userId = currentUser(request).id;

    await db.transaction(async (tx) => {
        await ownModule(tx, request.params, userId);
        await tx
            .update(modules)
            .set({ title: request.body.title })
            .where(eq(modules.id, request.params.moduleId));
    });

    return materialDetail(db, request.params.materialId, userId);
}

export async function deleteModule(
    request: FastifyRequest<{ Params: ModuleParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const { moduleId } = request.params;

    await db.transaction(async (tx) => {
        await ownModule(tx, request.params, currentUser(request).id);

        const [session] = await tx
            .select({ id: learningSessions.id })
            .from(learningSessions)
            .where(eq(learningSessions.moduleId, moduleId))
            .limit(1);

        if (session) {
            throw new AppError(409, {
                message: 'The module has missions',
                code: 'MODULE_HAS_SESSIONS',
            });
        }

        await tx.delete(modules).where(eq(modules.id, moduleId));
    });

    return reply.code(204).send();
}

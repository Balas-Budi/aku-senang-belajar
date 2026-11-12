import { isDeepStrictEqual } from 'node:util';
import {
    and,
    asc,
    eq,
    gte,
    inArray,
    isNull,
    ne,
    notExists,
    or,
    sql,
} from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { aiConfig } from '../../ai/chat.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    blockCompetencies,
    classes,
    classMembers,
    competencies,
    INTERESTS,
    learningSessions,
    materials,
    modules,
    sessionBlocks,
    sessionBlockThemes,
    sessionCompetencies,
    sessionThemes,
    studentProfiles,
    users,
} from '../../db/schema.ts';
import {
    diagramsOf,
    optionIds,
    sessionBlock,
    themeProblems,
    withoutDiagrams,
} from '../../learning/blocks.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError, validationError } from '../../lib/field-error.ts';
import {
    blocksWithCodes,
    sessionCompetencyIds,
    startDraft,
} from '../../studio/drafting.ts';
import { reviewSession } from '../../studio/review.ts';
import { pictureKeys, themedContent } from '../../studio/theme-draft.ts';
import { startThemeDraft, themeStates } from '../../studio/theming.ts';
import type {
    ApprovalBody,
    AssignmentBody,
    BlockBody,
    BlockParams,
    ModuleParams,
    MoveBody,
    ReadAloudBody,
    RevisionBody,
    SessionBody,
    SessionParams,
    StoryBody,
    ThemeBody,
    ThemeParams,
    ThemesBody,
} from './schema.ts';

const aiNotConfigured = () =>
    new AppError(503, {
        message: 'AI is not configured',
        code: 'AI_NOT_CONFIGURED',
    });

const stillDrafting = () =>
    new AppError(409, {
        message: 'The session is being drafted',
        code: 'SESSION_DRAFTING',
    });

const alreadyPublished = () =>
    new AppError(409, {
        message: 'The session is published',
        code: 'SESSION_PUBLISHED',
    });

const sessionChanged = () =>
    new AppError(409, {
        message: 'The draft changed after you opened it',
        code: 'SESSION_CHANGED',
    });

const themeDrafting = () =>
    new AppError(409, {
        message: 'The theme is being drafted',
        code: 'THEME_DRAFTING',
    });

const themeNotReady = () =>
    new AppError(409, {
        message: 'The theme is not complete',
        code: 'THEME_NOT_READY',
    });

const themeNotFound = () => notFound('Theme not found');

const generatingTheme = (sessionId: number) =>
    and(
        eq(sessionThemes.learningSessionId, sessionId),
        eq(sessionThemes.drafting, 'generating'),
    );

const idleDraft = (sessionId: number) =>
    and(
        eq(learningSessions.id, sessionId),
        eq(learningSessions.status, 'draft'),
        or(
            isNull(learningSessions.drafting),
            eq(learningSessions.drafting, 'failed'),
        ),
    );

async function claimSession(tx: Queryable, sessionId: number) {
    const [claimed] = await tx
        .update(learningSessions)
        .set({ version: sql`${learningSessions.version} + 1` })
        .where(idleDraft(sessionId))
        .returning({ id: learningSessions.id });

    if (claimed) return;

    const [now] = await tx
        .select({ status: learningSessions.status })
        .from(learningSessions)
        .where(eq(learningSessions.id, sessionId));

    if (now?.status === 'ready') throw alreadyPublished();

    throw stillDrafting();
}

async function themeRow(db: Queryable, sessionId: number, theme: string) {
    const [row] = await db
        .select({ id: sessionThemes.id, drafting: sessionThemes.drafting })
        .from(sessionThemes)
        .where(
            and(
                eq(sessionThemes.learningSessionId, sessionId),
                eq(sessionThemes.theme, theme),
            ),
        );

    return row;
}

async function hasGeneratingTheme(db: Queryable, sessionId: number) {
    const [row] = await db
        .select({ id: sessionThemes.id })
        .from(sessionThemes)
        .where(generatingTheme(sessionId))
        .limit(1);

    return row !== undefined;
}

export const visibleTo = (userId: number) =>
    or(
        eq(learningSessions.createdBy, userId),
        isNull(learningSessions.createdBy),
    );

async function ownSession(db: Queryable, sessionId: number, userId: number) {
    const [session] = await db
        .select({
            id: learningSessions.id,
            moduleId: learningSessions.moduleId,
            status: learningSessions.status,
            drafting: learningSessions.drafting,
            version: learningSessions.version,
        })
        .from(learningSessions)
        .where(
            and(
                eq(learningSessions.id, sessionId),
                eq(learningSessions.createdBy, userId),
            ),
        );

    if (!session) throw notFound('Session not found');

    return session;
}

async function editableSession(
    db: Queryable,
    sessionId: number,
    userId: number,
) {
    const session = await ownSession(db, sessionId, userId);

    if (session.status === 'ready') throw alreadyPublished();
    if (session.drafting === 'generating') throw stillDrafting();

    return session;
}

export async function createSession(
    request: FastifyRequest<{ Params: ModuleParams; Body: SessionBody }>,
    reply: FastifyReply,
) {
    const user = currentUser(request);
    const { db, env } = request.server;
    const [module] = await db
        .select({ id: modules.id, title: modules.title })
        .from(modules)
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(modules.id, request.params.moduleId),
                eq(materials.ownerId, user.id),
            ),
        );

    if (!module) throw notFound('Module not found');

    const chapter = (
        await db
            .select({ id: competencies.id })
            .from(competencies)
            .where(eq(competencies.moduleId, module.id))
    ).map(({ id }) => id);
    const chosen = new Set(request.body.competencyIds ?? chapter);

    if ([...chosen].some((id) => !chapter.includes(id))) {
        throw fieldError(
            'competencyIds',
            'Choose competencies of this chapter',
        );
    }

    if (!aiConfig(env)) throw aiNotConfigured();

    const session = await db.transaction(async (tx) => {
        const [created] = await tx
            .insert(learningSessions)
            .values({
                moduleId: module.id,
                title: module.title,
                summary: '',
                status: 'draft',
                createdBy: user.id,
                version: 0,
                drafting: 'generating',
                length: request.body.length ?? null,
            })
            .returning({ id: learningSessions.id });

        if (chosen.size > 0) {
            await tx.insert(sessionCompetencies).values(
                [...chosen].map((competencyId) => ({
                    learningSessionId: created.id,
                    competencyId,
                })),
            );
        }

        return created;
    });

    startDraft(request.server, session.id, null);

    return reply.code(202).send({ id: session.id });
}

function assignedClasses(db: Queryable, sessionId: number, teacherId: number) {
    return db
        .select({ id: classes.id, name: classes.name })
        .from(assignments)
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .where(
            and(
                eq(assignments.learningSessionId, sessionId),
                eq(classes.teacherId, teacherId),
            ),
        )
        .orderBy(asc(classes.name), asc(classes.id));
}

async function studioSession(db: Queryable, sessionId: number, userId: number) {
    const [session] = await db
        .select({
            id: learningSessions.id,
            title: learningSessions.title,
            summary: learningSessions.summary,
            status: learningSessions.status,
            version: learningSessions.version,
            drafting: learningSessions.drafting,
            draftError: learningSessions.draftError,
            length: learningSessions.length,
            readAloud: learningSessions.readAloud,
            createdBy: learningSessions.createdBy,
            module: {
                id: modules.id,
                title: modules.title,
                firstPage: modules.firstPage,
                lastPage: modules.lastPage,
            },
            material: { id: materials.id, title: materials.title },
        })
        .from(learningSessions)
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(and(eq(learningSessions.id, sessionId), visibleTo(userId)));

    if (!session) throw notFound('Session not found');

    const { createdBy, ...rest } = session;
    const review =
        createdBy !== null && session.status === 'draft'
            ? await reviewSession(db, session.id, session.module.id)
            : { issues: [], warnings: [] };

    return {
        ...rest,
        prepared: createdBy === null,
        competencies: await db
            .select({
                code: competencies.code,
                description: competencies.description,
            })
            .from(competencies)
            .where(
                inArray(competencies.id, sessionCompetencyIds(db, session.id)),
            )
            .orderBy(asc(competencies.id)),
        blocks: await blocksWithCodes(db, session.id),
        ...review,
        assignedClasses: await assignedClasses(db, session.id, userId),
        themes: await themeStates(db, session.id),
        interests: await interestCounts(db, userId),
    };
}

async function interestCounts(db: Queryable, teacherId: number) {
    const profiles = await db
        .selectDistinct({
            studentId: classMembers.studentId,
            interests: studentProfiles.interests,
        })
        .from(classMembers)
        .innerJoin(classes, eq(classes.id, classMembers.classId))
        .innerJoin(users, eq(users.id, classMembers.studentId))
        .innerJoin(
            studentProfiles,
            eq(studentProfiles.studentId, classMembers.studentId),
        )
        .where(and(eq(classes.teacherId, teacherId), isNull(users.deletedAt)));

    return INTERESTS.map((key) => ({
        key,
        students: profiles.filter(({ interests }) => interests.includes(key))
            .length,
    }));
}

export async function getSession(
    request: FastifyRequest<{ Params: SessionParams }>,
) {
    return studioSession(
        request.server.db,
        request.params.sessionId,
        currentUser(request).id,
    );
}

export async function editBlock(
    request: FastifyRequest<{ Params: BlockParams; Body: BlockBody }>,
) {
    const { db } = request.server;
    const session = await ownSession(
        db,
        request.params.sessionId,
        currentUser(request).id,
    );

    if (session.drafting === 'generating') throw stillDrafting();
    if (session.status === 'ready') throw alreadyPublished();

    const [block] = await db
        .select({ kind: sessionBlocks.kind, content: sessionBlocks.content })
        .from(sessionBlocks)
        .where(
            and(
                eq(sessionBlocks.id, request.params.blockId),
                eq(sessionBlocks.learningSessionId, session.id),
            ),
        );

    if (!block) throw notFound('Block not found');

    const edited = sessionBlock.safeParse({
        kind: block.kind,
        content: request.body.content,
    });

    if (!edited.success) {
        throw validationError(
            edited.error.issues.map((issue) => ({
                field: issue.path.join('/'),
                message: issue.message,
            })),
        );
    }

    const stored = sessionBlock.parse(block);

    if (optionIds(stored) !== optionIds(edited.data)) {
        throw fieldError('content/options', 'Keep the same options');
    }

    const before = new Map(
        diagramsOf(stored).map(({ path, diagram }) => [
            path.join('/'),
            diagram,
        ]),
    );

    for (const { path, diagram } of diagramsOf(edited.data)) {
        if (!isDeepStrictEqual(before.get(path.join('/')), diagram)) {
            throw fieldError(
                `content/${path.join('/')}`,
                'A picture can only be kept or removed',
            );
        }
    }

    await db.transaction(async (tx) => {
        await claimSession(tx, session.id);
        await tx
            .update(sessionBlocks)
            .set({ content: edited.data.content })
            .where(eq(sessionBlocks.id, request.params.blockId));
        await tx
            .update(sessionThemes)
            .set({ readBy: null, readAt: null })
            .where(
                and(
                    eq(sessionThemes.learningSessionId, session.id),
                    inArray(
                        sessionThemes.theme,
                        tx
                            .select({ theme: sessionBlockThemes.theme })
                            .from(sessionBlockThemes)
                            .where(
                                eq(
                                    sessionBlockThemes.blockId,
                                    request.params.blockId,
                                ),
                            ),
                    ),
                ),
            );
    });

    return { id: request.params.blockId, content: edited.data.content };
}

export async function reviseSession(
    request: FastifyRequest<{ Params: SessionParams; Body: RevisionBody }>,
    reply: FastifyReply,
) {
    const { db, env } = request.server;
    const session = await ownSession(
        db,
        request.params.sessionId,
        currentUser(request).id,
    );

    if (session.status === 'ready') throw alreadyPublished();
    if (!aiConfig(env)) throw aiNotConfigured();

    const claimed = await db.transaction(async (tx) => {
        await tx
            .select({ id: learningSessions.id })
            .from(learningSessions)
            .where(eq(learningSessions.id, session.id))
            .for('update');

        const [row] = await tx
            .update(learningSessions)
            .set({ drafting: 'generating', draftError: null })
            .where(
                and(
                    idleDraft(session.id),
                    notExists(
                        tx
                            .select({ id: sessionThemes.id })
                            .from(sessionThemes)
                            .where(generatingTheme(session.id)),
                    ),
                ),
            )
            .returning({ id: learningSessions.id });

        return row;
    });

    if (!claimed) {
        if (await hasGeneratingTheme(db, session.id)) throw themeDrafting();
        throw stillDrafting();
    }

    startDraft(request.server, session.id, request.body.note || null);

    return reply.code(202).send({ id: session.id });
}

export async function approveSession(
    request: FastifyRequest<{ Params: SessionParams; Body: ApprovalBody }>,
) {
    const { db } = request.server;
    const user = currentUser(request);
    const session = await ownSession(db, request.params.sessionId, user.id);

    if (session.drafting === 'generating') throw stillDrafting();
    if (session.status === 'ready') throw alreadyPublished();
    if (session.version !== request.body.version) throw sessionChanged();

    const { issues, warnings } = await reviewSession(
        db,
        session.id,
        session.moduleId,
    );

    if (issues.length > 0) {
        throw new AppError(409, {
            message: 'The session has issues that block publishing',
            code: 'PUBLISH_BLOCKED',
        });
    }

    const acknowledged = new Set(request.body.acknowledged);

    if (warnings.some(({ code }) => !acknowledged.has(code))) {
        throw new AppError(409, {
            message: 'Acknowledge every warning before publishing',
            code: 'WARNINGS_NOT_ACKNOWLEDGED',
        });
    }

    const [approved] = await db
        .update(learningSessions)
        .set({
            status: 'ready',
            drafting: null,
            draftError: null,
            approvedBy: user.id,
            approvedAt: new Date(),
            acknowledgedWarnings: warnings,
        })
        .where(
            and(
                eq(learningSessions.id, session.id),
                eq(learningSessions.status, 'draft'),
                eq(learningSessions.version, request.body.version),
                or(
                    isNull(learningSessions.drafting),
                    eq(learningSessions.drafting, 'failed'),
                ),
                notExists(
                    db
                        .select({ id: sessionThemes.id })
                        .from(sessionThemes)
                        .where(generatingTheme(session.id)),
                ),
            ),
        )
        .returning({ id: learningSessions.id });

    if (!approved) {
        const now = await ownSession(db, session.id, user.id);

        if (now.drafting === 'generating') throw stillDrafting();
        if (now.status === 'ready') throw alreadyPublished();
        if (now.version !== request.body.version) throw sessionChanged();
        if (await hasGeneratingTheme(db, session.id)) throw themeDrafting();

        throw stillDrafting();
    }

    return studioSession(db, session.id, user.id);
}

export async function assignSession(
    request: FastifyRequest<{ Params: SessionParams; Body: AssignmentBody }>,
) {
    const { db } = request.server;
    const user = currentUser(request);
    const [session] = await db
        .select({ id: learningSessions.id, status: learningSessions.status })
        .from(learningSessions)
        .where(
            and(
                eq(learningSessions.id, request.params.sessionId),
                visibleTo(user.id),
            ),
        );

    if (!session) throw notFound('Session not found');

    if (session.status !== 'ready') {
        throw new AppError(409, {
            message: 'Publish the session before assigning it',
            code: 'SESSION_NOT_READY',
        });
    }

    const classIds = [...new Set(request.body.classIds)];
    const owned = await db
        .select({ id: classes.id })
        .from(classes)
        .where(
            and(inArray(classes.id, classIds), eq(classes.teacherId, user.id)),
        );

    if (owned.length !== classIds.length) throw notFound('Class not found');

    await db
        .insert(assignments)
        .values(
            classIds.map((classId) => ({
                learningSessionId: session.id,
                classId,
            })),
        )
        .onConflictDoNothing();

    return assignedClasses(db, session.id, user.id);
}

export async function chooseThemes(
    request: FastifyRequest<{ Params: SessionParams; Body: ThemesBody }>,
    reply: FastifyReply,
) {
    const { db, env } = request.server;
    const session = await editableSession(
        db,
        request.params.sessionId,
        currentUser(request).id,
    );
    const [block] = await db
        .select({ id: sessionBlocks.id })
        .from(sessionBlocks)
        .where(eq(sessionBlocks.learningSessionId, session.id))
        .limit(1);

    if (!block) {
        throw new AppError(409, {
            message: 'Draft the session before choosing themes',
            code: 'SESSION_NOT_DRAFTED',
        });
    }

    if (!aiConfig(env)) throw aiNotConfigured();

    const { themes } = request.body;
    const rows = await db.transaction(async (tx) => {
        await claimSession(tx, session.id);

        const existing = (
            await tx
                .select({ theme: sessionThemes.theme })
                .from(sessionThemes)
                .where(eq(sessionThemes.learningSessionId, session.id))
        ).map(({ theme }) => theme);

        if (themes.some((theme) => existing.includes(theme))) {
            throw fieldError('themes', 'Already chosen');
        }

        if (existing.length + themes.length > 3) {
            throw fieldError('themes', 'At most three themes');
        }

        return tx
            .insert(sessionThemes)
            .values(
                themes.map((theme) => ({
                    learningSessionId: session.id,
                    theme,
                    drafting: 'generating' as const,
                })),
            )
            .returning({ id: sessionThemes.id });
    });

    for (const { id } of rows) {
        startThemeDraft(request.server, session.id, id, null);
    }

    return reply.code(202).send({ themes });
}

async function editTheme(
    db: Queryable,
    sessionId: number,
    theme: string,
    blockId: number,
    content: Record<string, unknown>,
) {
    const row = await themeRow(db, sessionId, theme);

    if (!row) throw themeNotFound();
    if (row.drafting === 'generating') throw themeDrafting();

    const [block] = await db
        .select({ kind: sessionBlocks.kind, content: sessionBlocks.content })
        .from(sessionBlocks)
        .where(
            and(
                eq(sessionBlocks.id, blockId),
                eq(sessionBlocks.learningSessionId, sessionId),
            ),
        );

    if (!block || block.kind === 'brain_game') {
        throw notFound('Block not found');
    }

    const pictures = pictureKeys(content);

    if (pictures.length > 0) {
        throw validationError(
            pictures.map((path) => ({
                field: `content/${path.join('/')}`,
                message: 'Pictures come from the base mission',
            })),
        );
    }

    const base = sessionBlock.safeParse(block);

    if (!base.success) {
        throw fieldError('content', 'Fix the base screen first');
    }

    const edited = themedContent(base.data, content);

    if (!edited.success) {
        throw validationError(
            edited.error.issues.map((issue) => ({
                field: issue.path.join('/'),
                message: issue.message,
            })),
        );
    }

    const problems = themeProblems(base.data, edited.data);

    if (problems.length > 0) {
        throw fieldError('content', problems.join('. '));
    }

    await db.transaction(async (tx) => {
        await claimSession(tx, sessionId);

        const [kept] = await tx
            .update(sessionThemes)
            .set({ readBy: null, readAt: null })
            .where(
                and(
                    eq(sessionThemes.id, row.id),
                    or(
                        isNull(sessionThemes.drafting),
                        eq(sessionThemes.drafting, 'failed'),
                    ),
                ),
            )
            .returning({ id: sessionThemes.id });

        if (!kept) {
            throw (await themeRow(tx, sessionId, theme))
                ? themeDrafting()
                : themeNotFound();
        }

        const stored = withoutDiagrams(edited.data.content);

        await tx
            .insert(sessionBlockThemes)
            .values({ blockId, theme, content: stored })
            .onConflictDoUpdate({
                target: [sessionBlockThemes.blockId, sessionBlockThemes.theme],
                set: { content: stored },
            });
    });

    return { theme, blockId, read: false };
}

async function markThemeRead(
    db: Queryable,
    sessionId: number,
    theme: string,
    userId: number,
    version: number,
) {
    const [marked] = await db
        .update(sessionThemes)
        .set({ readBy: userId, readAt: new Date() })
        .where(
            and(
                eq(sessionThemes.learningSessionId, sessionId),
                eq(sessionThemes.theme, theme),
                isNull(sessionThemes.drafting),
                inArray(
                    sessionThemes.learningSessionId,
                    db
                        .select({ id: learningSessions.id })
                        .from(learningSessions)
                        .where(
                            and(
                                eq(learningSessions.id, sessionId),
                                eq(learningSessions.status, 'draft'),
                                eq(learningSessions.version, version),
                            ),
                        ),
                ),
                notExists(
                    db
                        .select({ id: sessionBlocks.id })
                        .from(sessionBlocks)
                        .where(
                            and(
                                eq(sessionBlocks.learningSessionId, sessionId),
                                ne(sessionBlocks.kind, 'brain_game'),
                                notExists(
                                    db
                                        .select({ id: sessionBlockThemes.id })
                                        .from(sessionBlockThemes)
                                        .where(
                                            and(
                                                eq(
                                                    sessionBlockThemes.blockId,
                                                    sessionBlocks.id,
                                                ),
                                                eq(
                                                    sessionBlockThemes.theme,
                                                    theme,
                                                ),
                                            ),
                                        ),
                                ),
                            ),
                        ),
                ),
            ),
        )
        .returning({ id: sessionThemes.id });

    if (marked) return { theme, read: true };

    const row = await themeRow(db, sessionId, theme);

    if (!row) throw themeNotFound();

    const [session] = await db
        .select({
            status: learningSessions.status,
            version: learningSessions.version,
        })
        .from(learningSessions)
        .where(eq(learningSessions.id, sessionId));

    if (session?.status === 'ready') throw alreadyPublished();
    if (row.drafting === 'generating') throw themeDrafting();
    if (session?.version !== version) throw sessionChanged();

    throw themeNotReady();
}

export async function updateTheme(
    request: FastifyRequest<{ Params: ThemeParams; Body: ThemeBody }>,
) {
    const { db } = request.server;
    const user = currentUser(request);
    const session = await editableSession(
        db,
        request.params.sessionId,
        user.id,
    );
    const { body } = request;

    return 'read' in body
        ? markThemeRead(
              db,
              session.id,
              request.params.theme,
              user.id,
              body.version,
          )
        : editTheme(
              db,
              session.id,
              request.params.theme,
              body.blockId,
              body.content,
          );
}

export async function redraftTheme(
    request: FastifyRequest<{ Params: ThemeParams; Body: RevisionBody }>,
    reply: FastifyReply,
) {
    const { db, env } = request.server;
    const session = await editableSession(
        db,
        request.params.sessionId,
        currentUser(request).id,
    );
    const { theme } = request.params;
    const row = await themeRow(db, session.id, theme);

    if (!row) throw themeNotFound();
    if (!aiConfig(env)) throw aiNotConfigured();

    await db.transaction(async (tx) => {
        await claimSession(tx, session.id);

        const [claimed] = await tx
            .update(sessionThemes)
            .set({
                drafting: 'generating',
                draftError: null,
                readBy: null,
                readAt: null,
            })
            .where(
                and(
                    eq(sessionThemes.id, row.id),
                    or(
                        isNull(sessionThemes.drafting),
                        eq(sessionThemes.drafting, 'failed'),
                    ),
                ),
            )
            .returning({ id: sessionThemes.id });

        if (!claimed) {
            throw (await themeRow(tx, session.id, theme))
                ? themeDrafting()
                : themeNotFound();
        }
    });

    startThemeDraft(
        request.server,
        session.id,
        row.id,
        request.body.note || null,
    );

    return reply.code(202).send({ theme });
}

export async function removeTheme(
    request: FastifyRequest<{ Params: ThemeParams }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const session = await editableSession(
        db,
        request.params.sessionId,
        currentUser(request).id,
    );
    const { theme } = request.params;

    await db.transaction(async (tx) => {
        await claimSession(tx, session.id);

        const [removed] = await tx
            .delete(sessionThemes)
            .where(
                and(
                    eq(sessionThemes.learningSessionId, session.id),
                    eq(sessionThemes.theme, theme),
                ),
            )
            .returning({ id: sessionThemes.id });

        if (!removed) throw themeNotFound();

        await tx
            .delete(sessionBlockThemes)
            .where(
                and(
                    eq(sessionBlockThemes.theme, theme),
                    inArray(
                        sessionBlockThemes.blockId,
                        tx
                            .select({ id: sessionBlocks.id })
                            .from(sessionBlocks)
                            .where(
                                eq(sessionBlocks.learningSessionId, session.id),
                            ),
                    ),
                ),
            );
    });

    return reply.code(204).send();
}

const MIDDLE = new Set(['story', 'check']);
const STRUCTURE_SHIFT = 10_000;

const keepStructure = (message: string) =>
    new AppError(409, { message, code: 'KEEP_STRUCTURE' });

function layoutOf(db: Queryable, sessionId: number) {
    return db
        .select({
            id: sessionBlocks.id,
            position: sessionBlocks.position,
            kind: sessionBlocks.kind,
        })
        .from(sessionBlocks)
        .where(eq(sessionBlocks.learningSessionId, sessionId))
        .orderBy(asc(sessionBlocks.position));
}

async function claimStructure(tx: Queryable, sessionId: number) {
    await claimSession(tx, sessionId);

    if (await hasGeneratingTheme(tx, sessionId)) throw themeDrafting();

    await tx
        .update(sessionThemes)
        .set({ readBy: null, readAt: null })
        .where(eq(sessionThemes.learningSessionId, sessionId));
}

async function shiftFrom(
    tx: Queryable,
    sessionId: number,
    from: number,
    by: 1 | -1,
) {
    const ofSession = eq(sessionBlocks.learningSessionId, sessionId);

    await tx
        .update(sessionBlocks)
        .set({ position: sql`${sessionBlocks.position} + ${STRUCTURE_SHIFT}` })
        .where(and(ofSession, gte(sessionBlocks.position, from)));
    await tx
        .update(sessionBlocks)
        .set({
            position: sql`${sessionBlocks.position} - ${STRUCTURE_SHIFT - by}`,
        })
        .where(
            and(ofSession, gte(sessionBlocks.position, from + STRUCTURE_SHIFT)),
        );
}

async function untestedCodes(
    db: Queryable,
    sessionId: number,
    without?: number,
) {
    const tested = await db
        .selectDistinct({ id: blockCompetencies.competencyId })
        .from(blockCompetencies)
        .innerJoin(
            sessionBlocks,
            eq(sessionBlocks.id, blockCompetencies.blockId),
        )
        .where(
            and(
                eq(sessionBlocks.learningSessionId, sessionId),
                inArray(sessionBlocks.kind, ['check', 'challenge']),
                without === undefined
                    ? undefined
                    : ne(sessionBlocks.id, without),
            ),
        );
    const taught = await db
        .select({ id: competencies.id, code: competencies.code })
        .from(competencies)
        .where(inArray(competencies.id, sessionCompetencyIds(db, sessionId)));

    return taught
        .filter(({ id }) => !tested.some((row) => row.id === id))
        .map(({ code }) => code);
}

export async function addStory(
    request: FastifyRequest<{ Params: SessionParams; Body: StoryBody }>,
    reply: FastifyReply,
) {
    const { db } = request.server;
    const userId = currentUser(request).id;
    const session = await editableSession(db, request.params.sessionId, userId);
    const story = sessionBlock.safeParse({
        kind: 'story',
        content: { text: request.body.content.text },
    });

    if (!story.success) {
        throw validationError(
            story.error.issues.map((issue) => ({
                field: issue.path.join('/'),
                message: issue.message,
            })),
        );
    }

    await db.transaction(async (tx) => {
        await claimStructure(tx, session.id);

        const anchor = (await layoutOf(tx, session.id)).find(
            ({ id }) => id === request.body.after,
        );

        if (!anchor) throw notFound('Block not found');

        if (anchor.kind !== 'hook' && !MIDDLE.has(anchor.kind)) {
            throw keepStructure(
                'A story goes after the hook, a story, or a check',
            );
        }

        await shiftFrom(tx, session.id, anchor.position + 1, 1);
        await tx.insert(sessionBlocks).values({
            learningSessionId: session.id,
            position: anchor.position + 1,
            kind: 'story',
            content: story.data.content,
            sourcePages: [],
        });
    });

    return reply.code(201).send(await studioSession(db, session.id, userId));
}

export async function moveBlock(
    request: FastifyRequest<{ Params: BlockParams; Body: MoveBody }>,
) {
    const { db } = request.server;
    const userId = currentUser(request).id;
    const session = await editableSession(db, request.params.sessionId, userId);

    await db.transaction(async (tx) => {
        await claimStructure(tx, session.id);

        const layout = await layoutOf(tx, session.id);
        const index = layout.findIndex(
            ({ id }) => id === request.params.blockId,
        );

        if (index === -1) throw notFound('Block not found');

        const block = layout[index];
        const other = layout[index + (request.body.move === 'up' ? -1 : 1)];

        if (!MIDDLE.has(block.kind) || !other || !MIDDLE.has(other.kind)) {
            throw keepStructure(
                'Stories and checks move only between the hook and the challenge',
            );
        }

        await tx
            .update(sessionBlocks)
            .set({ position: -1 })
            .where(eq(sessionBlocks.id, block.id));
        await tx
            .update(sessionBlocks)
            .set({ position: block.position })
            .where(eq(sessionBlocks.id, other.id));
        await tx
            .update(sessionBlocks)
            .set({ position: other.position })
            .where(eq(sessionBlocks.id, block.id));
    });

    return studioSession(db, session.id, userId);
}

export async function removeBlock(
    request: FastifyRequest<{ Params: BlockParams }>,
) {
    const { db } = request.server;
    const userId = currentUser(request).id;
    const session = await editableSession(db, request.params.sessionId, userId);

    await db.transaction(async (tx) => {
        await claimStructure(tx, session.id);

        const layout = await layoutOf(tx, session.id);
        const block = layout.find(({ id }) => id === request.params.blockId);

        if (!block) throw notFound('Block not found');

        const left = layout.filter(({ id }) => id !== block.id);

        if (
            !MIDDLE.has(block.kind) ||
            left.filter(({ kind }) => kind === 'story').length < 2 ||
            !left.some(({ kind }) => kind === 'check')
        ) {
            throw keepStructure(
                'A misi keeps at least two stories and one check; only those can be removed',
            );
        }

        const before = await untestedCodes(tx, session.id);
        const lost = (await untestedCodes(tx, session.id, block.id)).filter(
            (code) => !before.includes(code),
        );

        if (lost.length > 0) {
            throw new AppError(409, {
                message: `Removing it leaves ${lost.join(', ')} untested`,
                code: 'COMPETENCY_UNTESTED',
            });
        }

        await tx.delete(sessionBlocks).where(eq(sessionBlocks.id, block.id));
        await shiftFrom(tx, session.id, block.position + 1, -1);
    });

    return studioSession(db, session.id, userId);
}

export async function setReadAloud(
    request: FastifyRequest<{ Params: SessionParams; Body: ReadAloudBody }>,
) {
    const { db } = request.server;
    const userId = currentUser(request).id;
    const session = await ownSession(db, request.params.sessionId, userId);

    await db
        .update(learningSessions)
        .set({ readAloud: request.body.readAloud })
        .where(eq(learningSessions.id, session.id));

    return studioSession(db, session.id, userId);
}

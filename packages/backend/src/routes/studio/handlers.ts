import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { aiConfig } from '../../ai/chat.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
    assignments,
    classes,
    competencies,
    learningSessions,
    materials,
    modules,
    sessionBlocks,
} from '../../db/schema.ts';
import { sessionBlock, type SessionBlock } from '../../learning/blocks.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import { fieldError, validationError } from '../../lib/field-error.ts';
import { blocksWithCodes, startDraft } from '../../studio/drafting.ts';
import { reviewSession } from '../../studio/review.ts';
import type {
    ApprovalBody,
    AssignmentBody,
    BlockBody,
    BlockParams,
    ModuleParams,
    RevisionBody,
    SessionParams,
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

const optionIds = ({ content }: SessionBlock) =>
    'options' in content ? content.options.map(({ id }) => id).join(',') : '';

const visibleTo = (userId: number) =>
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

export async function createSession(
    request: FastifyRequest<{ Params: ModuleParams }>,
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
    if (!aiConfig(env)) throw aiNotConfigured();

    const [session] = await db
        .insert(learningSessions)
        .values({
            moduleId: module.id,
            title: module.title,
            summary: '',
            status: 'draft',
            createdBy: user.id,
            version: 0,
            drafting: 'generating',
        })
        .returning({ id: learningSessions.id });

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
            .where(eq(competencies.moduleId, session.module.id))
            .orderBy(asc(competencies.id)),
        blocks: await blocksWithCodes(db, session.id),
        ...review,
        assignedClasses: await assignedClasses(db, session.id, userId),
    };
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

    await db
        .update(sessionBlocks)
        .set({ content: edited.data.content })
        .where(eq(sessionBlocks.id, request.params.blockId));

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

    const [claimed] = await db
        .update(learningSessions)
        .set({ drafting: 'generating', draftError: null })
        .where(
            and(
                eq(learningSessions.id, session.id),
                eq(learningSessions.status, 'draft'),
                or(
                    isNull(learningSessions.drafting),
                    eq(learningSessions.drafting, 'failed'),
                ),
            ),
        )
        .returning({ id: learningSessions.id });

    if (!claimed) throw stillDrafting();

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
                or(
                    isNull(learningSessions.drafting),
                    eq(learningSessions.drafting, 'failed'),
                ),
            ),
        )
        .returning({ id: learningSessions.id });

    if (!approved) throw stillDrafting();

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

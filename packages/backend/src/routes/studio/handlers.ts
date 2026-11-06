import { and, asc, eq, isNull, or } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { aiConfig } from '../../ai/chat.ts';
import { currentUser } from '../../auth/guards.ts';
import type { Queryable } from '../../db/index.ts';
import {
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
import type {
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

async function ownSession(db: Queryable, sessionId: number, userId: number) {
    const [session] = await db
        .select({
            id: learningSessions.id,
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

export async function getSession(
    request: FastifyRequest<{ Params: SessionParams }>,
) {
    const { db } = request.server;
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
        .where(
            and(
                eq(learningSessions.id, request.params.sessionId),
                or(
                    eq(learningSessions.createdBy, currentUser(request).id),
                    isNull(learningSessions.createdBy),
                ),
            ),
        );

    if (!session) throw notFound('Session not found');

    const { createdBy, ...rest } = session;

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
    };
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

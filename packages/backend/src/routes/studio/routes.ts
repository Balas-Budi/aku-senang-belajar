import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { trackDrafts } from '../../studio/drafting.ts';
import {
    approveSession,
    assignSession,
    createSession,
    editBlock,
    getSession,
    reviseSession,
} from './handlers.ts';
import {
    accepted,
    approvalBody,
    assignmentBody,
    blockBody,
    blockParams,
    classList,
    editedBlock,
    moduleParams,
    revisionBody,
    sessionBody,
    sessionParams,
    studioSession,
} from './schema.ts';

export const studioRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('teacher'));
    trackDrafts(fastify);

    fastify.post(
        '/modules/:moduleId/sessions',
        {
            schema: {
                params: moduleParams,
                body: sessionBody,
                response: { 202: accepted },
            },
        },
        createSession,
    );
    fastify.get(
        '/studio/sessions/:sessionId',
        { schema: { params: sessionParams, response: { 200: studioSession } } },
        getSession,
    );
    fastify.put(
        '/studio/sessions/:sessionId/blocks/:blockId',
        {
            schema: {
                params: blockParams,
                body: blockBody,
                response: { 200: editedBlock },
            },
        },
        editBlock,
    );
    fastify.post(
        '/studio/sessions/:sessionId/revisions',
        {
            schema: {
                params: sessionParams,
                body: revisionBody,
                response: { 202: accepted },
            },
        },
        reviseSession,
    );
    fastify.post(
        '/studio/sessions/:sessionId/approval',
        {
            schema: {
                params: sessionParams,
                body: approvalBody,
                response: { 200: studioSession },
            },
        },
        approveSession,
    );
    fastify.post(
        '/studio/sessions/:sessionId/assignments',
        {
            schema: {
                params: sessionParams,
                body: assignmentBody,
                response: { 200: classList },
            },
        },
        assignSession,
    );
};

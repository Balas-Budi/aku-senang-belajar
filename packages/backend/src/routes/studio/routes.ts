import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { trackDrafts } from '../../studio/drafting.ts';
import {
    createSession,
    editBlock,
    getSession,
    reviseSession,
} from './handlers.ts';
import {
    accepted,
    blockBody,
    blockParams,
    editedBlock,
    moduleParams,
    revisionBody,
    sessionParams,
    studioSession,
} from './schema.ts';

export const studioRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('teacher'));
    trackDrafts(fastify);

    fastify.post(
        '/modules/:moduleId/sessions',
        { schema: { params: moduleParams, response: { 202: accepted } } },
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
};

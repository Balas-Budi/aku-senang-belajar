import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import {
    changeLive,
    handleRequest,
    liveMonitor,
    openLive,
} from './handlers.ts';
import {
    changeBody,
    liveParams,
    liveResponse,
    monitorResponse,
    openBody,
    requestParams,
} from './schema.ts';

const path = '/classes/:classId/assignments/:assignmentId/live';

export const liveRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('teacher'));

    fastify.get(
        path,
        { schema: { params: liveParams, response: { 200: monitorResponse } } },
        liveMonitor,
    );
    fastify.post(
        path,
        {
            schema: {
                params: liveParams,
                body: openBody,
                response: { 201: liveResponse },
            },
        },
        openLive,
    );
    fastify.put(
        path,
        {
            schema: {
                params: liveParams,
                body: changeBody,
                response: { 200: liveResponse },
            },
        },
        changeLive,
    );
    fastify.put(
        `${path}/requests/:helpId`,
        { schema: { params: requestParams } },
        handleRequest,
    );
};

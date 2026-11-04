import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { joinClass, leaveClass, myAssignments, myClass } from './handlers.ts';
import {
    assignmentsResponse,
    classroomResponse,
    joinClassBody,
} from './schema.ts';

export const studentRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('student'));

    fastify.get(
        '/class',
        { schema: { response: { 200: classroomResponse } } },
        myClass,
    );
    fastify.post(
        '/class',
        {
            schema: {
                body: joinClassBody,
                response: { 201: classroomResponse },
            },
            preHandler: fastify.rateLimit({
                max: 10,
                timeWindow: '15 minutes',
                keyGenerator: (request) =>
                    `join-class:${request.user?.id ?? request.ip}`,
            }),
        },
        joinClass,
    );
    fastify.delete('/class', leaveClass);
    fastify.get(
        '/assignments',
        { schema: { response: { 200: assignmentsResponse } } },
        myAssignments,
    );
};

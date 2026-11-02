import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import {
    createClass,
    listClasses,
    listStudents,
    regenerateInviteCode,
    revokeInviteCode,
} from './handlers.ts';
import {
    classParams,
    classResponse,
    createClassBody,
    inviteCodeResponse,
    studentResponse,
} from './schema.ts';

export const classRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('teacher'));

    fastify.post(
        '/',
        { schema: { body: createClassBody, response: { 201: classResponse } } },
        createClass,
    );
    fastify.get(
        '/',
        { schema: { response: { 200: z.array(classResponse) } } },
        listClasses,
    );
    fastify.get(
        '/:classId/students',
        {
            schema: {
                params: classParams,
                response: { 200: z.array(studentResponse) },
            },
        },
        listStudents,
    );
    fastify.post(
        '/:classId/invite-code',
        {
            schema: {
                params: classParams,
                response: { 200: inviteCodeResponse },
            },
        },
        regenerateInviteCode,
    );
    fastify.delete(
        '/:classId/invite-code',
        { schema: { params: classParams } },
        revokeInviteCode,
    );
};

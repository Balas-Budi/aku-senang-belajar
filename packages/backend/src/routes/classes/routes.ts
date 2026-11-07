import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import {
    closeChapter,
    createClass,
    listChapters,
    listClasses,
    listStudents,
    openChapter,
    regenerateInviteCode,
    revokeInviteCode,
} from './handlers.ts';
import {
    bookResponse,
    chapterParams,
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
    fastify.get(
        '/:classId/chapters',
        {
            schema: {
                params: classParams,
                response: { 200: z.array(bookResponse) },
            },
        },
        listChapters,
    );
    fastify.put(
        '/:classId/chapters/:moduleId',
        { schema: { params: chapterParams } },
        openChapter,
    );
    fastify.delete(
        '/:classId/chapters/:moduleId',
        { schema: { params: chapterParams } },
        closeChapter,
    );
};

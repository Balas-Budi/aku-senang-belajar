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
import { changeMembership, membershipHistory } from './membership.ts';
import {
    bookResponse,
    chapterParams,
    classParams,
    classResponse,
    createClassBody,
    inviteCodeResponse,
    memberParams,
    membershipBody,
    membershipResponse,
    rosterResponse,
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
    fastify.put(
        '/:classId/students/:studentId/membership',
        {
            schema: {
                params: memberParams,
                body: membershipBody,
                response: { 200: rosterResponse },
            },
        },
        changeMembership,
    );
    fastify.get(
        '/:classId/membership',
        {
            schema: {
                params: classParams,
                response: { 200: membershipResponse },
            },
        },
        membershipHistory,
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

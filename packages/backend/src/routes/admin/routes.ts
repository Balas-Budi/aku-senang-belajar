import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { classroomResponse } from '../student/schema.ts';
import {
    createUser,
    importUsers,
    importUsersFile,
    listClasses,
    listUsers,
    moveStudent,
    resetPassword,
} from './handlers.ts';
import {
    adminClass,
    createdUser,
    createUserBody,
    importFileQuery,
    importUsersBody,
    listUsersQuery,
    managedUser,
    moveStudentBody,
    studentParams,
    userParams,
} from './schema.ts';
import { XLSX_CONTENT_TYPE } from './spreadsheet.ts';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const createdList = z.object({ created: z.array(createdUser) });

export const adminRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('admin'));
    fastify.addContentTypeParser(
        XLSX_CONTENT_TYPE,
        { parseAs: 'buffer', bodyLimit: MAX_FILE_BYTES },
        (_request, body, done) => done(null, body),
    );

    fastify.get(
        '/users',
        {
            schema: {
                querystring: listUsersQuery,
                response: { 200: z.array(managedUser) },
            },
        },
        listUsers,
    );
    fastify.post(
        '/users',
        { schema: { body: createUserBody, response: { 201: createdUser } } },
        createUser,
    );
    fastify.post(
        '/users/import',
        { schema: { body: importUsersBody, response: { 201: createdList } } },
        importUsers,
    );
    fastify.post(
        '/users/import-file',
        {
            schema: {
                querystring: importFileQuery,
                response: { 201: createdList },
            },
        },
        importUsersFile,
    );
    fastify.post(
        '/users/:userId/password',
        {
            schema: {
                params: userParams,
                response: { 200: z.object({ password: z.string() }) },
            },
        },
        resetPassword,
    );
    fastify.put(
        '/students/:studentId/class',
        {
            schema: {
                params: studentParams,
                body: moveStudentBody,
                response: { 200: classroomResponse },
            },
        },
        moveStudent,
    );
    fastify.get(
        '/classes',
        { schema: { response: { 200: z.array(adminClass) } } },
        listClasses,
    );
};

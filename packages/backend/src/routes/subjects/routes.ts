import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireUser } from '../../auth/guards.ts';
import { createSubject, deleteSubject, listSubjects } from './handlers.ts';
import { subjectBody, subjectItem, subjectParams } from './schema.ts';

export const subjectRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        '/',
        {
            onRequest: requireUser,
            schema: { response: { 200: z.array(subjectItem) } },
        },
        listSubjects,
    );
    fastify.post(
        '/',
        {
            onRequest: requireRole('teacher', 'admin'),
            schema: { body: subjectBody, response: { 201: subjectItem } },
        },
        createSubject,
    );
    fastify.delete(
        '/:key',
        {
            onRequest: requireRole('admin'),
            schema: { params: subjectParams },
        },
        deleteSubject,
    );
};

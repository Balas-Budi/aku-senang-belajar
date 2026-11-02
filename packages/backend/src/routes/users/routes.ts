import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { userResponse } from '../auth/schema.ts';
import { changeRole, deleteMe } from './handlers.ts';
import { changeRoleBody, userParams } from './schema.ts';

export const userRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.delete(
        '/me',
        { preHandler: requireRole('teacher', 'admin') },
        deleteMe,
    );
    fastify.put(
        '/:id/role',
        {
            schema: {
                params: userParams,
                body: changeRoleBody,
                response: { 200: userResponse },
            },
            preHandler: requireRole('admin'),
        },
        changeRole,
    );
};

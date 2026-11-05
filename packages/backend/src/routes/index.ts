import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { adminRoutes } from './admin/routes.ts';
import { authRoutes } from './auth/routes.ts';
import { classRoutes } from './classes/routes.ts';
import { resultRoutes } from './results/routes.ts';
import { studentRoutes } from './student/routes.ts';
import { userRoutes } from './users/routes.ts';

export const api: FastifyPluginAsyncZod = async (fastify) => {
    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(classRoutes, { prefix: '/classes' });
    await fastify.register(resultRoutes);
    await fastify.register(studentRoutes, { prefix: '/student' });
    await fastify.register(adminRoutes, { prefix: '/admin' });
    await fastify.register(userRoutes, { prefix: '/users' });
};

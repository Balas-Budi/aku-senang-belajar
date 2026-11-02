import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authRoutes } from './auth/routes.ts';
import { userRoutes } from './users/routes.ts';

export const api: FastifyPluginAsyncZod = async (fastify) => {
    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(userRoutes, { prefix: '/users' });
};

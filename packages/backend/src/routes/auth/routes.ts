import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireUser } from '../../auth/guards.ts';
import { changePassword, login, logout, logoutAll, me } from './handlers.ts';
import { changePasswordBody, loginBody, userResponse } from './schema.ts';

function usernameOf(request: FastifyRequest): string {
    const { body } = request;

    return typeof body === 'object' &&
        body !== null &&
        'username' in body &&
        typeof body.username === 'string'
        ? body.username
        : '';
}

export const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.post(
        '/login',
        {
            schema: { body: loginBody, response: { 200: userResponse } },
            preHandler: [
                fastify.rateLimit({
                    max: 5,
                    timeWindow: '15 minutes',
                    keyGenerator: (request) =>
                        `login:${request.ip}:${usernameOf(request)}`,
                }),
                fastify.rateLimit({
                    max: 100,
                    timeWindow: '15 minutes',
                    keyGenerator: (request) => `login:${request.ip}`,
                }),
            ],
        },
        login,
    );

    fastify.post('/logout', { preHandler: requireUser }, logout);
    fastify.post('/logout-all', { preHandler: requireUser }, logoutAll);
    fastify.get(
        '/me',
        {
            schema: { response: { 200: userResponse } },
            preHandler: requireUser,
        },
        me,
    );
    fastify.put(
        '/password',
        {
            schema: { body: changePasswordBody },
            preHandler: requireRole('teacher', 'admin'),
        },
        changePassword,
    );
};

import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.ts';
import { findSession, sessionCookie } from './sessions.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function registerAuth(app: FastifyInstance): void {
    const { name } = sessionCookie(app.env);

    app.addHook('onRequest', async (request) => {
        if (
            !SAFE_METHODS.has(request.method) &&
            request.headers.origin !== app.env.APP_ORIGIN
        ) {
            throw new AppError(403, {
                message: 'Request origin is not allowed',
                code: 'INVALID_ORIGIN',
            });
        }
    });

    app.addHook('onRequest', async (request) => {
        const token = request.cookies[name];

        if (token) {
            request.user = await findSession(app.db, token);
        }
    });
}

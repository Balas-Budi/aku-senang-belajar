import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import {
    serializerCompiler,
    validatorCompiler,
} from 'fastify-type-provider-zod';
import { registerAuth } from './auth/hooks.ts';
import { createDatabase, type Database } from './db/index.ts';
import type { Env } from './env.ts';
import { registerErrorHandling } from './lib/error-handler.ts';
import { AppError } from './lib/errors.ts';
import { api } from './routes/index.ts';

declare module 'fastify' {
    interface FastifyInstance {
        db: Database;
        env: Env;
    }
}

export async function buildApp(env: Env) {
    const app = Fastify({ logger: { level: env.LOG_LEVEL } });

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerErrorHandling(app);

    const database = createDatabase(env.DATABASE_URL);

    app.decorate('env', env);
    app.decorate('db', database.db);
    app.addHook('onClose', async () => {
        await database.pool.end();
    });

    await app.register(cookie);
    await app.register(rateLimit, {
        global: false,
        errorResponseBuilder: (_request, context) =>
            new AppError(429, {
                message: `Too many attempts, retry in ${context.after}`,
                code: 'RATE_LIMITED',
            }),
    });

    registerAuth(app);
    await app.register(api, { prefix: '/api' });

    return app;
}

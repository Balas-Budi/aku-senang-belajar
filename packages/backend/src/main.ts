import Fastify from 'fastify';
import { createDatabase } from './db/index.js';

const app = Fastify({ logger: true });
const database = process.env.DATABASE_URL
    ? createDatabase(process.env.DATABASE_URL)
    : undefined;

app.get('/api/health', async () => ({
    message: 'Aku senang belajar!',
    status: 'ok',
}));

app.get('/api/lessons', async (request, reply) => {
    if (!database)
        return reply
            .code(503)
            .send({ error: 'Set DATABASE_URL and run migrations first.' });

    try {
        return await database.db.query.lessons.findMany();
    } catch (error) {
        request.log.error({ err: error }, 'Failed to retrieve lessons');

        return reply.code(500).send({ error: 'Unable to retrieve lessons.' });
    }
});

app.addHook('onClose', async () => {
    await database?.pool.end();
});

try {
    await app.listen({
        port: Number(process.env.PORT ?? 3000),
        host: '127.0.0.1',
    });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}

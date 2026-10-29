import Fastify from 'fastify';
import { createDatabase } from './db/index.js';

const app = Fastify({ logger: true });
const database = process.env.DATABASE_URL
    ? createDatabase(process.env.DATABASE_URL)
    : undefined;

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

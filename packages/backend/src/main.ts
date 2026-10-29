import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import { createDatabase } from './db/index.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

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

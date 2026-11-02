import { existsSync } from 'node:fs';
import { buildApp } from './app.ts';
import { loadEnv } from './env.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

const env = loadEnv();
const app = await buildApp(env);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, async () => {
        await app.close();
        process.exit(0);
    });
}

try {
    await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    schema: './packages/backend/src/db/schema.ts',
    out: './packages/backend/drizzle',
    dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    schema: './packages/backend/src/db/schema.ts',
    out: './packages/backend/drizzle',
    casing: 'snake_case',
    dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});

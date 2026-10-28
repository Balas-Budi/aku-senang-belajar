import { pgTable, integer, text } from 'drizzle-orm/pg-core';

export const lessons = pgTable('lessons', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: text().notNull(),
});

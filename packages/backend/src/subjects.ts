import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from './db/index.ts';
import { materials, subjects } from './db/schema.ts';
import { fieldError } from './lib/field-error.ts';

/** A subject key: one of the built-in four or one a teacher or admin added. */
export type Subject = string;

export const subjectKey = z.string().trim().min(1).max(80);

export const SUBJECT_COLORS = [
    'pink',
    'blue',
    'green',
    'orange',
    'purple',
] as const;

/** The four built-in subjects, whose keys are also their drawings. */
export const BUILT_IN_SUBJECTS = [
    'mathematics',
    'natural_and_social_science',
    'indonesian_language',
    'pancasila_education',
] as const;

/** The four built-in drawings first, then the icons for added subjects. */
export const SUBJECT_ICONS = [
    'mathematics',
    'natural_and_social_science',
    'indonesian_language',
    'pancasila_education',
    'book',
    'globe',
    'music',
    'brush',
    'ball',
    'leaf',
    'prayer',
    'computer',
] as const;

/** Every subject key in display order: built-in ones first, then by when they were added. */
export async function subjectKeys(db: Queryable) {
    const rows = await db
        .select({ key: subjects.key })
        .from(subjects)
        .orderBy(asc(subjects.position));
    return rows.map(({ key }) => key);
}

/** Refuses a key no subject has, as a field error on `subject`. */
export async function requireSubject(db: Queryable, key: string) {
    const [row] = await db
        .select({ key: subjects.key })
        .from(subjects)
        .where(eq(subjects.key, key));
    if (!row) throw fieldError('subject', 'Unknown subject');
}

/** Lower-case words joined by dashes, ASCII only: "Seni Budaya" becomes "seni-budaya". */
export function slugOf(name: string) {
    const slug = name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return slug || 'mapel';
}

export const sameName = (name: string) =>
    sql`lower(${subjects.name}) = lower(${name})`;

/** The material's subject name, for AI prompts that should read "Seni Budaya" rather than its key. */
export const materialSubjectName = sql<string>`(select ${subjects.name} from ${subjects} where ${subjects.key} = ${materials.subject})`;

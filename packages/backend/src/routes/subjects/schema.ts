import { z } from 'zod';
import { SUBJECT_COLORS, SUBJECT_ICONS } from '../../subjects.ts';

export const subjectItem = z.object({
    key: z.string(),
    name: z.string(),
    color: z.string(),
    icon: z.string(),
    builtIn: z.boolean(),
    books: z.number(),
});

export const subjectBody = z.object({
    name: z.string().trim().min(2).max(40),
    color: z.enum(SUBJECT_COLORS),
    icon: z.enum(SUBJECT_ICONS),
});

export const subjectParams = z.object({ key: z.string().min(1).max(80) });

export type SubjectBody = z.infer<typeof subjectBody>;
export type SubjectParams = z.infer<typeof subjectParams>;

import { z } from 'zod';
import { subject } from '../../db/schema.ts';

export const classParams = z.object({
    classId: z.coerce.number().int().positive(),
});
export const createClassBody = z.object({
    name: z.string().trim().min(1).max(60),
});

export const classResponse = z.object({
    id: z.number(),
    name: z.string(),
    inviteCode: z.string().nullable(),
    studentCount: z.number(),
});

export const studentResponse = z.object({
    id: z.number(),
    name: z.string(),
    joinedAt: z.date(),
});

export const inviteCodeResponse = z.object({ inviteCode: z.string() });

export const chapterParams = classParams.extend({
    moduleId: z.coerce.number().int().positive(),
});

export const bookResponse = z.object({
    id: z.number(),
    title: z.string(),
    subject: z.enum(subject.enumValues),
    prepared: z.boolean(),
    chapters: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            openStages: z.number(),
            waitingStages: z.number(),
            started: z.boolean(),
        }),
    ),
});

export type ClassParams = z.infer<typeof classParams>;
export type ChapterParams = z.infer<typeof chapterParams>;
export type CreateClassBody = z.infer<typeof createClassBody>;

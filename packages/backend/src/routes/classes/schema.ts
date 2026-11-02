import { z } from 'zod';

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

export type ClassParams = z.infer<typeof classParams>;
export type CreateClassBody = z.infer<typeof createClassBody>;

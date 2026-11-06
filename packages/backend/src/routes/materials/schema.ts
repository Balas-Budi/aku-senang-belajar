import { z } from 'zod';
import { learningSessionStatus, subject } from '../../db/schema.ts';

export const uploadQuery = z.object({
    title: z.string().trim().min(1).max(120),
    subject: z.enum(subject.enumValues),
    grade: z.coerce.number().int().min(1).max(6),
    rights: z.literal('1', { error: 'Confirm the right to use this material' }),
});

export type UploadQuery = z.infer<typeof uploadQuery>;

export const materialParams = z.object({
    materialId: z.coerce.number().int().positive(),
});

export type MaterialParams = z.infer<typeof materialParams>;

export const pageParams = materialParams.extend({
    number: z.coerce.number().int().positive(),
});

export type PageParams = z.infer<typeof pageParams>;

export const materialSummary = z.object({
    id: z.number(),
    title: z.string(),
    subject: z.enum(subject.enumValues),
    grade: z.number().nullable(),
    prepared: z.boolean(),
    pageCount: z.number(),
    readablePages: z.number(),
});

export const materialDetail = materialSummary.extend({
    pages: z.array(
        z.object({
            number: z.number(),
            readable: z.boolean(),
            snippet: z.string().nullable(),
        }),
    ),
    modules: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            sessions: z.array(
                z.object({
                    id: z.number(),
                    title: z.string(),
                    status: z.enum(learningSessionStatus.enumValues),
                }),
            ),
        }),
    ),
});

export const pageText = z.object({
    number: z.number(),
    text: z.string().nullable(),
});

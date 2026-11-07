import { z } from 'zod';
import {
    learningSessionStatus,
    sessionDrafting,
    subject,
} from '../../db/schema.ts';
import {
    competencyDraft,
    competencyProposal,
} from '../../studio/competencies.ts';

export { competencyProposal };

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

export const pageRange = z.object({
    title: z.string().trim().min(1).max(120),
    firstPage: z.number().int().positive(),
    lastPage: z.number().int().positive(),
});

export type PageRange = z.infer<typeof pageRange>;

export const moduleBody = pageRange.extend({
    competencies: z.array(competencyDraft).min(1).max(6),
});

export type ModuleBody = z.infer<typeof moduleBody>;

export const savedModule = z.object({
    id: z.number(),
    title: z.string(),
    firstPage: z.number().nullable(),
    lastPage: z.number().nullable(),
    competencies: z.array(
        z.object({
            id: z.number(),
            code: z.string(),
            description: z.string(),
            pages: z.array(z.number()),
        }),
    ),
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
        savedModule.extend({
            sessions: z.array(
                z.object({
                    id: z.number(),
                    title: z.string(),
                    status: z.enum(learningSessionStatus.enumValues),
                    drafting: z.enum(sessionDrafting.enumValues).nullable(),
                    competencies: z.array(z.string()),
                }),
            ),
        }),
    ),
});

export const pageText = z.object({
    number: z.number(),
    text: z.string().nullable(),
});

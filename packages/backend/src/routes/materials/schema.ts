import { z } from 'zod';
import {
    learningSessionStatus,
    materialLicence,
    materialReading,
    moduleOrigin,
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
    source: z.string().trim().max(200).optional(),
    licence: z.enum(materialLicence.enumValues).optional(),
    licenceNote: z.string().trim().max(300).optional(),
});

const cleared = (limit: number) =>
    z
        .string()
        .trim()
        .max(limit)
        .transform((text) => text || null)
        .nullable();

export const materialBody = z.object({
    archived: z.boolean().optional(),
    version: z.int().positive().optional(),
    source: cleared(200).optional(),
    licence: z.enum(materialLicence.enumValues).nullable().optional(),
    licenceNote: cleared(300).optional(),
});

export type MaterialBody = z.infer<typeof materialBody>;

export const pageQuery = z.object({
    version: z.coerce.number().int().positive().optional(),
});

export type PageQuery = z.infer<typeof pageQuery>;

export type UploadQuery = z.infer<typeof uploadQuery>;

export const materialParams = z.object({
    materialId: z.coerce.number().int().positive(),
});

export type MaterialParams = z.infer<typeof materialParams>;

export const pageParams = materialParams.extend({
    number: z.coerce.number().int().positive(),
});

export type PageParams = z.infer<typeof pageParams>;

export const moduleParams = materialParams.extend({
    moduleId: z.coerce.number().int().positive(),
});

export type ModuleParams = z.infer<typeof moduleParams>;

export const moduleTitle = z.object({
    title: z.string().trim().min(1).max(120),
});

export type ModuleTitle = z.infer<typeof moduleTitle>;

export const readingStarted = z.object({ reading: z.literal('reading_pages') });

export const materialSummary = z.object({
    id: z.number(),
    title: z.string(),
    subject: z.enum(subject.enumValues),
    grade: z.number().nullable(),
    prepared: z.boolean(),
    archived: z.boolean(),
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
    version: z.number(),
    source: z.string().nullable(),
    licence: z.enum(materialLicence.enumValues).nullable(),
    licenceNote: z.string().nullable(),
    reading: z.object({
        state: z.enum(materialReading.enumValues),
        error: z.string().nullable(),
        pictured: z.number(),
        described: z.number(),
        chapters: z.number().nullable(),
    }),
    versions: z.array(
        z.object({
            version: z.number(),
            createdAt: z.date(),
            pageCount: z.number(),
            readablePages: z.number(),
            chapters: z.number(),
        }),
    ),
    pages: z.array(
        z.object({
            number: z.number(),
            readable: z.boolean(),
            snippet: z.string().nullable(),
        }),
    ),
    modules: z.array(
        savedModule.extend({
            version: z.number(),
            madeBy: z.enum(moduleOrigin.enumValues),
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
    visual: z.string().nullable(),
});

import { z } from 'zod';
import {
    blockKind,
    learningSessionStatus,
    sessionDrafting,
} from '../../db/schema.ts';

export const moduleParams = z.object({
    moduleId: z.coerce.number().int().positive(),
});

export type ModuleParams = z.infer<typeof moduleParams>;

export const sessionParams = z.object({
    sessionId: z.coerce.number().int().positive(),
});

export type SessionParams = z.infer<typeof sessionParams>;

export const blockParams = sessionParams.extend({
    blockId: z.coerce.number().int().positive(),
});

export type BlockParams = z.infer<typeof blockParams>;

export const revisionBody = z.object({
    note: z.string().trim().max(500).optional(),
});

export type RevisionBody = z.infer<typeof revisionBody>;

const content = z.record(z.string(), z.unknown());

export const blockBody = z.object({ content });

export type BlockBody = z.infer<typeof blockBody>;

export const accepted = z.object({ id: z.number() });

export const editedBlock = z.object({ id: z.number(), content });

export const studioSession = z.object({
    id: z.number(),
    title: z.string(),
    summary: z.string(),
    status: z.enum(learningSessionStatus.enumValues),
    version: z.number(),
    drafting: z.enum(sessionDrafting.enumValues).nullable(),
    draftError: z.string().nullable(),
    prepared: z.boolean(),
    module: z.object({
        id: z.number(),
        title: z.string(),
        firstPage: z.number().nullable(),
        lastPage: z.number().nullable(),
    }),
    material: z.object({ id: z.number(), title: z.string() }),
    competencies: z.array(
        z.object({ code: z.string(), description: z.string() }),
    ),
    blocks: z.array(
        z.object({
            id: z.number(),
            position: z.number(),
            kind: z.enum(blockKind.enumValues),
            content,
            competencies: z.array(z.string()),
            sourcePages: z.array(z.number()),
        }),
    ),
});

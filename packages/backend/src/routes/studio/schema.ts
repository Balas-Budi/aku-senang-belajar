import { z } from 'zod';
import {
    blockKind,
    learningSessionStatus,
    sessionDrafting,
} from '../../db/schema.ts';
import { warningCodes } from '../../studio/review.ts';

export const moduleParams = z.object({
    moduleId: z.coerce.number().int().positive(),
});

export type ModuleParams = z.infer<typeof moduleParams>;

export const sessionBody = z.object({
    competencyIds: z
        .array(z.int().positive())
        .min(1, 'Choose at least one competency')
        .max(50)
        .optional(),
});

export type SessionBody = z.infer<typeof sessionBody>;

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

export const approvalBody = z.object({
    acknowledged: z.array(z.enum(warningCodes)).max(warningCodes.length),
    version: z.int().nonnegative(),
});

export type ApprovalBody = z.infer<typeof approvalBody>;

export const assignmentBody = z.object({
    classIds: z
        .array(z.int().positive())
        .min(1, 'Choose at least one class')
        .max(50),
});

export type AssignmentBody = z.infer<typeof assignmentBody>;

export const accepted = z.object({ id: z.number() });

export const editedBlock = z.object({ id: z.number(), content });

export const classList = z.array(
    z.object({ id: z.number(), name: z.string() }),
);

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
    issues: z.array(
        z.object({
            code: z.string(),
            competencies: z.array(z.string()).optional(),
            blocks: z.array(z.number()).optional(),
        }),
    ),
    warnings: z.array(
        z.object({
            code: z.enum(warningCodes),
            blocks: z.array(z.number()).optional(),
            pages: z.array(z.number()).optional(),
        }),
    ),
    assignedClasses: classList,
});

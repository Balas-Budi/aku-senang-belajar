import { z } from 'zod';
import {
    INTERESTS,
    blockKind,
    learningSessionStatus,
    materialLicence,
    sessionDrafting,
    sessionLength,
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
    length: z.enum(sessionLength.enumValues).optional(),
});

export type SessionBody = z.infer<typeof sessionBody>;

export const storyBody = z.object({
    after: z.int().positive(),
    content: z.record(z.string(), z.unknown()),
});

export type StoryBody = z.infer<typeof storyBody>;

export const moveBody = z.object({ move: z.enum(['up', 'down']) });

export type MoveBody = z.infer<typeof moveBody>;

export const readAloudBody = z.object({ readAloud: z.boolean() });

export type ReadAloudBody = z.infer<typeof readAloudBody>;

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

export const themeParams = sessionParams.extend({
    theme: z.enum(INTERESTS),
});

export type ThemeParams = z.infer<typeof themeParams>;

export const themesBody = z.object({
    themes: z
        .array(z.enum(INTERESTS))
        .min(1)
        .max(3)
        .refine(
            (themes) => new Set(themes).size === themes.length,
            'Choose each theme once',
        ),
});

export type ThemesBody = z.infer<typeof themesBody>;

export const themeBody = z.union([
    z.object({ blockId: z.int().positive(), content }),
    z.object({ read: z.literal(true), version: z.int().nonnegative() }),
]);

export type ThemeBody = z.infer<typeof themeBody>;

export const chosenThemes = z.object({ themes: z.array(z.string()) });

export const themeChange = z.object({
    theme: z.string(),
    blockId: z.number().optional(),
    read: z.boolean(),
});

export const themeAccepted = z.object({ theme: z.string() });

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
    length: z.enum(sessionLength.enumValues).nullable(),
    readAloud: z.boolean(),
    prepared: z.boolean(),
    module: z.object({
        id: z.number(),
        title: z.string(),
        firstPage: z.number().nullable(),
        lastPage: z.number().nullable(),
        materialVersion: z.number(),
    }),
    material: z.object({
        id: z.number(),
        title: z.string(),
        source: z.string().nullable(),
        licence: z.enum(materialLicence.enumValues).nullable(),
        licenceNote: z.string().nullable(),
    }),
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
            themes: z.array(z.string()).optional(),
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
    themes: z.array(
        z.object({
            theme: z.string(),
            drafting: z.enum(sessionDrafting.enumValues).nullable(),
            draftError: z.string().nullable(),
            read: z.boolean(),
            readAt: z.date().nullable(),
            mismatch: z.boolean(),
            complete: z.boolean(),
            blocks: z.array(z.object({ id: z.number(), content })),
        }),
    ),
    interests: z.array(
        z.object({ key: z.enum(INTERESTS), students: z.number() }),
    ),
});

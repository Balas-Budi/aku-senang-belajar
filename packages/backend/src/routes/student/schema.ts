import { z } from 'zod';
import { INVITE_CODE_LENGTH, normalizeCode } from '../../auth/codes.ts';
import { attemptStatus, responseOutcome, subject } from '../../db/schema.ts';
import { blockContent, steps } from '../../learning/blocks.ts';

export const TRY_LIMIT = 3;

export const joinClassBody = z.object({
    inviteCode: z
        .string()
        .max(32)
        .transform(normalizeCode)
        .pipe(z.string().length(INVITE_CODE_LENGTH)),
});

export const classroom = z.object({
    id: z.number(),
    name: z.string(),
    teacherName: z.string(),
});

export const classroomResponse = z.object({ classroom: classroom.nullable() });

const assignmentFields = {
    id: z.number(),
    title: z.string(),
    summary: z.string(),
    subject: z.enum(subject.enumValues),
    moduleId: z.number(),
    moduleTitle: z.string(),
};

const stage = z.object({
    id: z.number(),
    title: z.string(),
    summary: z.string(),
    progress: z.enum(['not_started', 'in_progress', 'submitted']),
    step: z.enum(steps).nullable(),
    locked: z.boolean(),
});

export const pathResponse = z.object({
    subjects: z.array(
        z.object({
            subject: z.enum(subject.enumValues),
            chapters: z.array(
                z.object({
                    id: z.number(),
                    title: z.string(),
                    book: z.string(),
                    open: z.boolean(),
                    stages: z.array(stage),
                }),
            ),
        }),
    ),
});

export const assignmentParams = z.object({
    assignmentId: z.coerce.number().int().positive(),
});

export const attemptParams = z.object({
    attemptId: z.coerce.number().int().positive(),
});

const choice = z.string().regex(/^[a-z]$/);
const typedText = z.string().trim().min(1).max(500);

export const answer = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('hook'), choice }),
    z.object({
        kind: z.literal('check'),
        choice,
        reason: typedText.optional(),
    }),
    z.object({ kind: z.literal('challenge'), choice, reason: typedText }),
    z.object({
        kind: z.literal('reflection'),
        understood: z.array(z.string()).max(4),
        confusing: z.array(z.string()).max(4),
        note: typedText.optional(),
    }),
]);

export const checkpointBody = z.object({ blockId: z.int().positive() });

export const responseBody = z.object({
    blockId: z.int().positive(),
    tryNumber: z.int().min(1).max(TRY_LIMIT),
    answer,
});

export const helpBody = z.object({
    blockId: z.int().positive(),
    kind: z.enum(['hint', 'example', 'ask_teacher']),
});

const picture = blockContent.check.shape.example;

const earned = z.object({
    hints: z.array(picture),
    example: picture.nullable(),
    praise: z.string().nullable(),
    reveal: z.object({ answer: z.string(), text: z.string() }).nullable(),
});

const shown = { id: z.number(), position: z.number(), step: z.enum(steps) };

const visibleBlock = z.discriminatedUnion('kind', [
    z.object({
        ...shown,
        kind: z.literal('brain_game'),
        content: blockContent.brain_game,
    }),
    z.object({
        ...shown,
        kind: z.literal('hook'),
        content: blockContent.hook,
    }),
    z.object({
        ...shown,
        kind: z.literal('story'),
        content: blockContent.story,
    }),
    z.object({
        ...shown,
        kind: z.literal('check'),
        content: blockContent.check.omit({
            answer: true,
            praise: true,
            hints: true,
            example: true,
            reveal: true,
        }),
        earned,
    }),
    z.object({
        ...shown,
        kind: z.literal('challenge'),
        content: blockContent.challenge.omit({ answer: true }),
    }),
    z.object({
        ...shown,
        kind: z.literal('reflection'),
        content: blockContent.reflection.omit({ takeaways: true }),
    }),
]);

export const doneResponse = z.object({
    takeaways: z.array(z.string()),
    toPractise: z.array(z.string()),
});

export const attemptResponse = z.object({
    id: z.number(),
    status: z.enum(attemptStatus.enumValues),
    checkpoint: z.number(),
    answers: z.array(
        z.object({
            blockId: z.number(),
            tryNumber: z.number(),
            answer,
            outcome: z.enum(responseOutcome.enumValues),
        }),
    ),
    done: doneResponse.nullable(),
});

export const assignmentResponse = z.object({
    ...assignmentFields,
    blocks: z.array(visibleBlock),
    attempt: attemptResponse.nullable(),
});

export const feedbackResponse = z.object({
    outcome: z.enum(responseOutcome.enumValues),
    earned: earned.nullable(),
});

export const helpResponse = z.object({ earned: earned.nullable() });

export const INTERESTS = [
    'animals',
    'football',
    'superheroes',
    'space',
    'music',
    'drawing',
    'cooking',
    'nature',
] as const;

export const profileBody = z.object({
    interests: z
        .array(z.enum(INTERESTS))
        .refine(
            (chosen) => new Set(chosen).size === chosen.length,
            'Each interest can be chosen once',
        ),
});

export const profileResponse = z.object({
    profile: z
        .object({
            interests: z.array(z.enum(INTERESTS)),
            updatedAt: z.date(),
        })
        .nullable(),
});

export type JoinClassBody = z.infer<typeof joinClassBody>;
export type AssignmentParams = z.infer<typeof assignmentParams>;
export type AttemptParams = z.infer<typeof attemptParams>;
export type Answer = z.infer<typeof answer>;
export type CheckpointBody = z.infer<typeof checkpointBody>;
export type ResponseBody = z.infer<typeof responseBody>;
export type HelpBody = z.infer<typeof helpBody>;
export type ProfileBody = z.infer<typeof profileBody>;

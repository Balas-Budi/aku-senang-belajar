import { z } from 'zod';
import { challengeMode, challengeState } from '../../db/schema.ts';

export const challengeParams = z.object({
    classId: z.coerce.number().int().positive(),
});

const text = z.string().trim().min(1).max(300);

const options = z
    .array(
        z.object({
            id: z.string().regex(/^[a-d]$/),
            label: z.string().trim().min(1).max(200),
        }),
    )
    .min(2)
    .max(4)
    .refine(
        (list) => new Set(list.map(({ id }) => id)).size === list.length,
        'Each option needs its own id',
    );

export const startBody = z
    .object({
        prompt: z.string().trim().min(1).max(600),
        options,
        mode: z.enum(challengeMode.enumValues),
        groupSize: z.int().min(2).max(5).optional(),
    })
    .refine(({ mode, groupSize }) => mode === 'solo' || groupSize, {
        path: ['groupSize'],
        message: 'Choose how many students a group has',
    });

export const changeBody = z.object({
    action: z.enum(['reveal', 'show', 'cluster', 'close']),
    answerIds: z.array(z.int().positive()).max(60).optional(),
});

export const answerBody = z.object({
    challengeId: z.int().positive(),
    choice: z.string().regex(/^[a-d]$/),
    reason: text,
});

const option = z.object({ id: z.string(), label: z.string() });
const count = z.object({ id: z.string(), count: z.number() });
const mode = z.enum(challengeMode.enumValues);
const state = z.enum(challengeState.enumValues);
const group = z.object({ name: z.string(), members: z.array(z.string()) });

const teacherChallenge = z.object({
    id: z.number(),
    prompt: z.string(),
    options: z.array(option),
    mode,
    state,
    units: z.number(),
    answered: z.number(),
    groups: z.array(group.extend({ id: z.number() })),
    counts: z.array(count),
    answers: z.array(
        z.object({
            id: z.number(),
            choice: z.string(),
            reason: z.string(),
            shown: z.boolean(),
        }),
    ),
    clusters: z
        .array(
            z.object({
                label: z.string(),
                note: z.string(),
                answerIds: z.array(z.number()),
            }),
        )
        .nullable(),
    createdAt: z.date(),
});

export const challengeResponse = z.object({
    challenge: teacherChallenge.nullable(),
});

export const startedResponse = z.object({ challenge: teacherChallenge });

export const sourcesResponse = z.object({
    sources: z.array(
        z.object({
            blockId: z.number(),
            mission: z.string(),
            prompt: z.string(),
            options: z.array(option),
        }),
    ),
});

const given = z.object({ choice: z.string(), reason: z.string() });

export const studentChallengeResponse = z.object({
    challenge: z
        .object({
            id: z.number(),
            prompt: z.string(),
            options: z.array(option),
            mode,
            state,
            group: group.nullable(),
            answered: given.nullable(),
            result: z
                .object({
                    total: z.number(),
                    counts: z.array(count),
                    reasons: z.array(given),
                })
                .nullable(),
        })
        .nullable(),
});

export const answeredResponse = z.object({ answered: given });

export type ChallengeParams = z.infer<typeof challengeParams>;
export type StartBody = z.infer<typeof startBody>;
export type ChangeBody = z.infer<typeof changeBody>;
export type AnswerBody = z.infer<typeof answerBody>;

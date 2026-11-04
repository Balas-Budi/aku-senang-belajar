import { z } from 'zod';

const illustration = z.enum([
    'loaf-whole',
    'loaf-quarters',
    'loaf-quarters-unequal',
    'loaf-quarter-marked',
    'loaf-halves',
    'loaf-pair',
    'round-quarters',
    'round-quarters-unequal',
    'round-quarter-marked',
    'round-thirds',
    'paper-quarters',
]);

const screenText = z
    .string()
    .trim()
    .min(1)
    .refine(
        (text) => text.split(/(?<=[.!?])\s+/).length <= 2,
        'A student screen holds at most two sentences',
    );

const picture = z.object({
    text: screenText,
    illustration: illustration.optional(),
});

const options = z
    .array(
        z.object({
            id: z.string().regex(/^[a-z]$/),
            label: z.string().trim().min(1),
            illustration: illustration.optional(),
        }),
    )
    .min(2)
    .max(4)
    .refine(
        (list) => new Set(list.map((option) => option.id)).size === list.length,
        'Each option needs its own id',
    );

function answerIsAnOption(block: {
    options: { id: string }[];
    answer: string;
}) {
    return block.options.some((option) => option.id === block.answer);
}

const answerError = {
    path: ['answer'],
    message: 'The answer must be one of the options',
};

export const blockContent = {
    brain_game: z.object({ game: z.enum(['memory_pairs']) }),
    hook: z.object({
        prompt: screenText,
        illustration: illustration.optional(),
        options,
    }),
    story: z.object({
        text: screenText,
        illustration,
        fraction: z
            .object({
                numerator: z.int().positive(),
                denominator: z.int().positive(),
                numeratorNote: z.string().trim().min(1),
                denominatorNote: z.string().trim().min(1),
            })
            .optional(),
    }),
    check: z.object({
        prompt: screenText,
        illustration: illustration.optional(),
        options,
        answer: z.string(),
        reason: z
            .object({
                prompt: screenText,
                starters: z.array(z.string().trim().min(1)).min(1).max(3),
            })
            .optional(),
        praise: screenText,
        hints: z.tuple([picture, picture, picture]),
        example: picture,
        reveal: screenText,
    }),
    challenge: z.object({
        prompt: screenText,
        question: screenText,
        illustration: illustration.optional(),
        options,
        answer: z.string(),
        reasonStarter: z.string().trim().min(1),
    }),
    reflection: z.object({
        topics: z.array(z.string().trim().min(1)).min(2).max(4),
        takeaways: z.array(screenText).min(1).max(3),
    }),
};

export const sessionBlock = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('brain_game'),
        content: blockContent.brain_game,
    }),
    z.object({ kind: z.literal('hook'), content: blockContent.hook }),
    z.object({ kind: z.literal('story'), content: blockContent.story }),
    z.object({
        kind: z.literal('check'),
        content: blockContent.check.refine(answerIsAnOption, answerError),
    }),
    z.object({
        kind: z.literal('challenge'),
        content: blockContent.challenge.refine(answerIsAnOption, answerError),
    }),
    z.object({
        kind: z.literal('reflection'),
        content: blockContent.reflection,
    }),
]);

export type SessionBlock = z.infer<typeof sessionBlock>;

export const steps = ['opening', 'story', 'challenge', 'reflection'] as const;

export const stepOfKind = {
    brain_game: 'opening',
    hook: 'opening',
    story: 'story',
    check: 'story',
    challenge: 'challenge',
    reflection: 'reflection',
} satisfies Record<SessionBlock['kind'], (typeof steps)[number]>;

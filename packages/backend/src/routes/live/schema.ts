import { z } from 'zod';
import { liveMode, liveState } from '../../db/schema.ts';
import { steps } from '../../learning/blocks.ts';

export const liveParams = z.object({
    classId: z.coerce.number().int().positive(),
    assignmentId: z.coerce.number().int().positive(),
});

export const requestParams = liveParams.extend({
    helpId: z.coerce.number().int().positive(),
});

export const openBody = z.object({
    mode: z.enum(liveMode.enumValues),
    minutes: z.int().min(5).max(120).optional(),
});

export const changeBody = z.object({
    action: z.enum(['pause', 'resume', 'advance', 'extend', 'end']),
    minutes: z.int().min(5).max(60).optional(),
});

const step = z.enum(steps);

export const studentLive = z.object({
    mode: z.enum(liveMode.enumValues),
    state: z.enum(liveState.enumValues),
    openStep: step,
    endsAt: z.date().nullable(),
});

const live = studentLive.extend({ startedAt: z.date() });

export const liveResponse = z.object({ live });

export const studentLiveResponse = z.object({ live: studentLive.nullable() });

export const monitorResponse = z.object({
    live: live.nullable(),
    students: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            state: z.enum(['not_started', 'active', 'offline', 'done']),
            step: step.nullable(),
        }),
    ),
    requests: z.array(
        z.object({
            id: z.number(),
            studentId: z.number(),
            name: z.string(),
            step: step.nullable(),
            askedAt: z.date(),
        }),
    ),
});

export type LiveParams = z.infer<typeof liveParams>;
export type RequestParams = z.infer<typeof requestParams>;
export type OpenBody = z.infer<typeof openBody>;
export type ChangeBody = z.infer<typeof changeBody>;

import { z } from 'zod';
import { followUpKind, subject, understandingStatus } from '../../db/schema.ts';
import { reviewQuestion, reviewQuery } from '../student/schema.ts';

const id = z.coerce.number().int().positive();

export const classParams = z.object({ classId: id });
export const followUpParams = classParams.extend({ followUpId: id });
export const studentFollowUpParams = z.object({ followUpId: id });
export const studentFollowUpsQuery = reviewQuery;

export const createBody = z
    .object({
        assignmentId: z.int().positive(),
        kind: z.enum(followUpKind.enumValues),
        competencyId: z.int().positive().optional(),
        studentIds: z
            .array(z.int().positive())
            .min(1)
            .max(60)
            .refine(
                (list) => new Set(list).size === list.length,
                'Choose each student once',
            ),
        note: z.string().trim().max(300).optional(),
    })
    .refine(
        ({ kind, competencyId }) =>
            (kind === 'enrich') === (competencyId === undefined),
        {
            path: ['competencyId'],
            message: 'Enrichment has no competency; every other kind needs one',
        },
    );

export const doneBody = z.object({ done: z.boolean() });

const kind = z.enum(followUpKind.enumValues);
const practice = z
    .object({ done: z.number(), total: z.number(), right: z.number() })
    .nullable();

const followUp = z.object({
    id: z.number(),
    kind,
    assignmentId: z.number(),
    mission: z.string(),
    subject: z.enum(subject.enumValues),
    competency: z
        .object({ id: z.number(), code: z.string(), description: z.string() })
        .nullable(),
    note: z.string().nullable(),
    createdAt: z.date(),
    doneAt: z.date().nullable(),
    students: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            status: z.enum(understandingStatus.enumValues).nullable(),
            practice,
        }),
    ),
});

export const followUpResponse = z.object({ followUp });
export const followUpsResponse = z.object({ followUps: z.array(followUp) });

const offered = z.object({
    id: z.number(),
    kind,
    mission: z.string(),
    competency: z.string().nullable(),
    note: z.string().nullable(),
});

export const studentFollowUpsResponse = z.object({
    followUps: z.array(
        offered.extend({
            practice: z.object({
                done: z.number(),
                total: z.number(),
                right: z.number(),
            }),
        }),
    ),
});

export const studentFollowUpResponse = z.object({
    followUp: offered.extend({ subject: z.enum(subject.enumValues) }),
    questions: z.array(reviewQuestion),
});

export type ClassParams = z.infer<typeof classParams>;
export type FollowUpParams = z.infer<typeof followUpParams>;
export type StudentFollowUpParams = z.infer<typeof studentFollowUpParams>;
export type StudentFollowUpsQuery = z.infer<typeof studentFollowUpsQuery>;
export type CreateBody = z.infer<typeof createBody>;
export type DoneBody = z.infer<typeof doneBody>;

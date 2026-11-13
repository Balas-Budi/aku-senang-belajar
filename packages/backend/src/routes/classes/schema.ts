import { z } from 'zod';
import { membershipAction, membershipEnd, role } from '../../db/schema.ts';
import { subjectKey } from '../../subjects.ts';

export const classParams = z.object({
    classId: z.coerce.number().int().positive(),
});
export const createClassBody = z.object({
    name: z.string().trim().min(1).max(60),
});

export const classResponse = z.object({
    id: z.number(),
    name: z.string(),
    inviteCode: z.string().nullable(),
    studentCount: z.number(),
});

export const studentResponse = z.object({
    id: z.number(),
    name: z.string(),
    joinedAt: z.date(),
    inactive: z.boolean(),
});

export const memberParams = classParams.extend({
    studentId: z.coerce.number().int().positive(),
});

export const membershipBody = z
    .object({
        action: z.enum(['deactivate', 'reactivate', 'archive', 'move']),
        classId: z.int().positive().optional(),
    })
    .refine(
        ({ action, classId }) =>
            (action === 'move') === (classId !== undefined),
        { path: ['classId'], message: 'Only a move names a class to move to' },
    );

export const rosterResponse = z.object({ students: z.array(studentResponse) });

export const membershipResponse = z.object({
    events: z.array(
        z.object({
            id: z.number(),
            action: z.enum(membershipAction.enumValues),
            student: z.object({ id: z.number(), name: z.string() }),
            actor: z.enum(role.enumValues).nullable(),
            otherClass: z.string().nullable(),
            direction: z.enum(['in', 'out']).nullable(),
            createdAt: z.date(),
        }),
    ),
    past: z.array(
        z.object({
            studentId: z.number(),
            name: z.string(),
            joinedAt: z.date(),
            endedAt: z.date(),
            reason: z.enum(membershipEnd.enumValues),
            submitted: z.number(),
        }),
    ),
});

export const inviteCodeResponse = z.object({ inviteCode: z.string() });

export const chapterParams = classParams.extend({
    moduleId: z.coerce.number().int().positive(),
});

export const bookResponse = z.object({
    id: z.number(),
    title: z.string(),
    subject: subjectKey,
    prepared: z.boolean(),
    chapters: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            openStages: z.number(),
            waitingStages: z.number(),
            started: z.boolean(),
        }),
    ),
});

export type ClassParams = z.infer<typeof classParams>;
export type MemberParams = z.infer<typeof memberParams>;
export type MembershipBody = z.infer<typeof membershipBody>;
export type ChapterParams = z.infer<typeof chapterParams>;
export type CreateClassBody = z.infer<typeof createClassBody>;

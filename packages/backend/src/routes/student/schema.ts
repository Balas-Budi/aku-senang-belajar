import { z } from 'zod';
import { INVITE_CODE_LENGTH, normalizeCode } from '../../auth/codes.ts';
import { subject } from '../../db/schema.ts';

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

export const assignmentsResponse = z.array(
    z.object({
        id: z.number(),
        title: z.string(),
        summary: z.string(),
        subject: z.enum(subject.enumValues),
        moduleTitle: z.string(),
    }),
);

export type JoinClassBody = z.infer<typeof joinClassBody>;

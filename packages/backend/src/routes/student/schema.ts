import { z } from 'zod';
import { INVITE_CODE_LENGTH, normalizeCode } from '../../auth/codes.ts';

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

export type JoinClassBody = z.infer<typeof joinClassBody>;

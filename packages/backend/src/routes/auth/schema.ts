import { z } from 'zod';
import { role } from '../../db/schema.ts';
import type { Role } from '../../auth/guards.ts';

export const PASSWORD_MIN: Record<Role, number> = {
    student: 8,
    teacher: 15,
    admin: 15,
};
export const passwordForRole = (userRole: Role) =>
    z.string().min(PASSWORD_MIN[userRole]).max(128);

export const username = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
        z
            .string()
            .regex(
                /^[a-z0-9._-]{3,32}$/,
                'Use 3 to 32 letters, digits, dots, dashes, or underscores',
            ),
    );
export const personName = z.string().trim().min(1).max(60);
const givenPassword = z.string().min(1).max(128);

export const loginBody = z.object({
    username: z.string().trim().toLowerCase().min(1).max(64),
    password: givenPassword,
    rememberMe: z.boolean().default(false),
});
export const changePasswordBody = z.object({
    currentPassword: givenPassword,
    newPassword: z.string().min(8).max(128),
});

export const userResponse = z.object({
    id: z.number(),
    role: z.enum(role.enumValues),
    name: z.string(),
    username: z.string(),
});

export type LoginBody = z.infer<typeof loginBody>;
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;

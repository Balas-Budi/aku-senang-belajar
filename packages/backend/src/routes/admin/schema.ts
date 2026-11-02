import { z } from 'zod';
import { personName, username } from '../auth/schema.ts';
import { classroom } from '../student/schema.ts';

export const managedRole = z.enum(['teacher', 'student']);
export type ManagedRole = z.infer<typeof managedRole>;

export const PASSWORD_MIN: Record<ManagedRole, number> = {
    teacher: 15,
    student: 8,
};
export const GENERATED_PASSWORD_LENGTH: Record<ManagedRole, number> = {
    teacher: 16,
    student: 8,
};
export const MAX_IMPORT_ROWS = 500;

const userRow = z.object({
    name: personName,
    username,
    password: z.string().max(128).optional(),
});

function checkPasswords(
    role: ManagedRole,
    rows: { password?: string }[],
    context: z.RefinementCtx,
    pathOf: (index: number) => (string | number)[],
) {
    rows.forEach((row, index) => {
        if (
            row.password !== undefined &&
            row.password.length < PASSWORD_MIN[role]
        ) {
            context.addIssue({
                code: 'custom',
                message: `Password needs at least ${PASSWORD_MIN[role]} characters`,
                path: pathOf(index),
            });
        }
    });
}

export const createUserBody = userRow
    .extend({ role: managedRole })
    .superRefine((body, context) =>
        checkPasswords(body.role, [body], context, () => ['password']),
    );

export const importUsersBody = z
    .object({
        role: managedRole,
        users: z.array(userRow).min(1).max(MAX_IMPORT_ROWS),
    })
    .superRefine((body, context) => {
        checkPasswords(body.role, body.users, context, (index) => [
            'users',
            index,
            'password',
        ]);

        const seen = new Set<string>();

        body.users.forEach((row, index) => {
            if (seen.has(row.username)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Username appears more than once in this list',
                    path: ['users', index, 'username'],
                });
            }

            seen.add(row.username);
        });
    });

export const importFileQuery = z.object({ role: managedRole });
export const listUsersQuery = z.object({ role: managedRole });
export const userParams = z.object({
    userId: z.coerce.number().int().positive(),
});
export const studentParams = z.object({
    studentId: z.coerce.number().int().positive(),
});
export const moveStudentBody = z.object({
    classId: z.number().int().positive().nullable(),
});

export const createdUser = z.object({
    id: z.number(),
    role: managedRole,
    name: z.string(),
    username: z.string(),
    generatedPassword: z.string().nullable(),
});

export const managedUser = z.object({
    id: z.number(),
    role: managedRole,
    name: z.string(),
    username: z.string(),
    classroom: classroom.nullable(),
});

export const adminClass = z.object({
    id: z.number(),
    name: z.string(),
    teacherName: z.string(),
    studentCount: z.number(),
});

export type CreateUserBody = z.infer<typeof createUserBody>;
export type ImportUsersBody = z.infer<typeof importUsersBody>;
export type ImportFileQuery = z.infer<typeof importFileQuery>;
export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type UserParams = z.infer<typeof userParams>;
export type StudentParams = z.infer<typeof studentParams>;
export type MoveStudentBody = z.infer<typeof moveStudentBody>;

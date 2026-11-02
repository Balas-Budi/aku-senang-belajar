import { z } from 'zod';

export const userParams = z.object({ id: z.coerce.number().int().positive() });
export const changeRoleBody = z.object({ role: z.enum(['teacher', 'admin']) });

export type UserParams = z.infer<typeof userParams>;
export type ChangeRoleBody = z.infer<typeof changeRoleBody>;

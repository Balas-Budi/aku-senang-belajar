import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Classroom } from '../classes/queries';
export type ManagedRole = 'teacher' | 'student';
export type ManagedUser = {
    id: number;
    role: ManagedRole;
    name: string;
    username: string;
    classroom: Classroom | null;
};
export type CreatedUser = {
    id: number;
    role: ManagedRole;
    name: string;
    username: string;
    generatedPassword: string | null;
};
export const usersQuery = (role: ManagedRole, cookie?: string | null) =>
    queryOptions({
        queryKey: ['admin', 'users', role],
        queryFn: () =>
            api<ManagedUser[]>(`/api/admin/users?role=${role}`, {
                headers: cookie ? { cookie } : undefined,
            }),
    });
export const adminClassesQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['admin', 'classes'],
        queryFn: () =>
            api<(Classroom & { studentCount: number })[]>(
                '/api/admin/classes',
                { headers: cookie ? { cookie } : undefined },
            ),
    });
export function useCreateUser() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (input: {
            role: ManagedRole;
            name: string;
            username: string;
            password?: string;
        }) =>
            api<CreatedUser>('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify(input),
            }),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['admin', 'users'] }),
        gcTime: 0,
    });
}
export function useImportUsers() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ role, file }: { role: ManagedRole; file: File }) =>
            api<{ created: CreatedUser[] }>(
                `/api/admin/users/import-file?role=${role}`,
                {
                    method: 'POST',
                    body: file,
                    headers: {
                        'content-type':
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    },
                },
            ),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['admin', 'users'] }),
        gcTime: 0,
    });
}
export function useResetPassword() {
    return useMutation({
        mutationFn: (id: number) =>
            api<{ password: string }>(`/api/admin/users/${id}/password`, {
                method: 'POST',
            }),
        gcTime: 0,
    });
}
export function useDeleteMemory() {
    return useMutation({
        mutationFn: (id: number) =>
            api(`/api/admin/students/${id}/memory`, { method: 'DELETE' }),
    });
}
export function useMoveStudent() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ id, classId }: { id: number; classId: number | null }) =>
            api(`/api/admin/students/${id}/class`, {
                method: 'PUT',
                body: JSON.stringify({ classId }),
            }),
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ['admin'] }),
                client.invalidateQueries({ queryKey: ['classes'] }),
                client.invalidateQueries({ queryKey: ['student', 'class'] }),
            ]);
        },
    });
}

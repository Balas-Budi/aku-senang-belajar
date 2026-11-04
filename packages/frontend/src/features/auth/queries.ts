import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
export type Role = 'student' | 'teacher' | 'admin';
export type User = { id: number; role: Role; name: string; username: string };
export const roleHome = (role: Role) => `/${role}`;
export const meQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['auth', 'me'],
        queryFn: () =>
            api<User>('/api/auth/me', {
                headers: cookie ? { cookie } : undefined,
            }),
        retry: false,
    });
export function useLogin() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (input: {
            username: string;
            password: string;
            rememberMe: boolean;
        }) =>
            api<User>('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify(input),
            }),
        onSuccess: (user) => {
            client.clear();
            client.setQueryData(meQuery().queryKey, user);
        },
    });
}
export function useLogout() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
        onSuccess: () => client.clear(),
    });
}
export function useLogoutAll() {
    return useMutation({
        mutationFn: () => api<void>('/api/auth/logout-all', { method: 'POST' }),
    });
}
export function useChangePassword() {
    return useMutation({
        mutationFn: (input: { currentPassword: string; newPassword: string }) =>
            api<void>('/api/auth/password', {
                method: 'PUT',
                body: JSON.stringify(input),
            }),
        gcTime: 0,
    });
}
export function useDeleteAccount() {
    return useMutation({
        mutationFn: () => api<void>('/api/users/me', { method: 'DELETE' }),
    });
}

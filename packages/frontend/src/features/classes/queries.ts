import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
export type Classroom = { id: number; name: string; teacherName: string };
export type TeacherClass = {
    id: number;
    name: string;
    inviteCode: string | null;
    studentCount: number;
};
const headers = (cookie?: string | null) => (cookie ? { cookie } : undefined);
export const studentClassQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'class'],
        queryFn: () =>
            api<{ classroom: Classroom | null }>('/api/student/class', {
                headers: headers(cookie),
            }),
    });
export const classesQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['classes'],
        queryFn: () =>
            api<TeacherClass[]>('/api/classes', { headers: headers(cookie) }),
    });
export const rosterQuery = (id: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['classes', id, 'students'],
        queryFn: () =>
            api<{ id: number; name: string; joinedAt: string }[]>(
                `/api/classes/${id}/students`,
                { headers: headers(cookie) },
            ),
    });
export function useJoinClass() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (inviteCode: string) =>
            api('/api/student/class', {
                method: 'POST',
                body: JSON.stringify({ inviteCode }),
            }),
        onSuccess: () => client.invalidateQueries({ queryKey: ['student'] }),
    });
}
export function useLeaveClass() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: () => api('/api/student/class', { method: 'DELETE' }),
        onSuccess: () => client.invalidateQueries({ queryKey: ['student'] }),
    });
}
export function useCreateClass() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (name: string) =>
            api('/api/classes', {
                method: 'POST',
                body: JSON.stringify({ name }),
            }),
        onSuccess: () => client.invalidateQueries({ queryKey: ['classes'] }),
    });
}
export function useChangeCode(id: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (method: 'POST' | 'DELETE') =>
            api(`/api/classes/${id}/invite-code`, { method }),
        onSuccess: () => client.invalidateQueries({ queryKey: ['classes'] }),
    });
}

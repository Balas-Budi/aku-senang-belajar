import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Subject } from '../assignments/queries';
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
export type ClassBook = {
    id: number;
    title: string;
    subject: Subject;
    prepared: boolean;
    chapters: {
        id: number;
        title: string;
        openStages: number;
        waitingStages: number;
        started: boolean;
    }[];
};
export const classChaptersQuery = (id: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['classes', id, 'chapters'],
        queryFn: () =>
            api<ClassBook[]>(`/api/classes/${id}/chapters`, {
                headers: headers(cookie),
            }),
    });
export function useChapterAccess(classId: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({
            chapterId,
            method,
        }: {
            chapterId: number;
            method: 'PUT' | 'DELETE';
        }) => api(`/api/classes/${classId}/chapters/${chapterId}`, { method }),
        // Opening and closing change the class missions list as well.
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['classes', classId] }),
    });
}

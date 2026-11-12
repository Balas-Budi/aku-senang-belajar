import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { Subject } from '../assignments/queries';
export type Classroom = { id: number; name: string; teacherName: string };
export type TeacherClass = {
    id: number;
    name: string;
    inviteCode: string | null;
    studentCount: number;
};
export type RosterStudent = {
    id: number;
    name: string;
    joinedAt: string;
    inactive: boolean;
};
export type MembershipAction = 'move' | 'deactivate' | 'reactivate' | 'archive';
export type MembershipEvent = {
    id: number;
    action:
        | 'joined'
        | 'left'
        | 'moved'
        | 'deactivated'
        | 'reactivated'
        | 'archived';
    student: { id: number; name: string };
    actor: 'teacher' | 'student' | 'admin' | null;
    otherClass: string | null;
    direction: 'in' | 'out' | null;
    createdAt: string;
};
export type PastMember = {
    studentId: number;
    name: string;
    joinedAt: string;
    endedAt: string;
    reason: 'left' | 'moved' | 'archived';
    submitted: number;
};
const headers = (cookie?: string | null) => (cookie ? { cookie } : undefined);
export const studentClassQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'class'],
        queryFn: () =>
            api<{ classroom: (Classroom & { inactive: boolean }) | null }>(
                '/api/student/class',
                { headers: headers(cookie) },
            ),
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
            api<RosterStudent[]>(`/api/classes/${id}/students`, {
                headers: headers(cookie),
            }),
    });
export const classMembershipQuery = (id: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['classes', id, 'membership'],
        queryFn: () =>
            api<{ events: MembershipEvent[]; past: PastMember[] }>(
                `/api/classes/${id}/membership`,
                { headers: headers(cookie) },
            ),
    });
export function useChangeMembership(classId: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({
            studentId,
            ...body
        }: {
            studentId: number;
            action: MembershipAction;
            classId?: number;
        }) =>
            api<{ students: RosterStudent[] }>(
                `/api/classes/${classId}/students/${studentId}/membership`,
                { method: 'PUT', body: JSON.stringify(body) },
            ),
        onSuccess: ({ students }) => {
            client.setQueryData(rosterQuery(classId).queryKey, students);
        },
        onSettled: (_data, error) => {
            if (!error || (error instanceof ApiError && error.status < 500))
                void client.invalidateQueries({ queryKey: ['classes'] });
        },
    });
}
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
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['classes', classId] }),
    });
}

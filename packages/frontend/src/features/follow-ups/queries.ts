import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import type { Competency, UnderstandingStatus } from '../results/queries';
import { type ReviewQuestion, usePracticeTry } from '../review/queries';

export type FollowUpKind = 'reinforce' | 'enrich' | 'discuss' | 'reteach';
export type Practice = { done: number; total: number; right: number };

export type FollowUp = {
    id: number;
    kind: FollowUpKind;
    assignmentId: number;
    mission: string;
    subject: Subject;
    competency: Competency | null;
    note: string | null;
    createdAt: string;
    doneAt: string | null;
    students: {
        id: number;
        name: string;
        status: UnderstandingStatus | null;
        practice: Practice | null;
    }[];
};

export type FollowUpInput = {
    assignmentId: number;
    kind: FollowUpKind;
    competencyId?: number;
    studentIds: number[];
    note?: string;
};

export type OfferedFollowUp = {
    id: number;
    kind: FollowUpKind;
    mission: string;
    competency: string | null;
    note: string | null;
};

const headers = (cookie?: string | null) => (cookie ? { cookie } : undefined);

export const classFollowUpsQuery = (classId: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['classes', classId, 'follow-ups'],
        queryFn: () =>
            api<{ followUps: FollowUp[] }>(
                `/api/classes/${classId}/follow-ups`,
                { headers: headers(cookie) },
            ),
    });

export function useCreateFollowUp(classId: number) {
    const client = useQueryClient();

    return useMutation({
        mutationFn: (input: FollowUpInput) =>
            api<{ followUp: FollowUp }>(`/api/classes/${classId}/follow-ups`, {
                method: 'POST',
                body: JSON.stringify(input),
            }),
        onSuccess: () =>
            client.invalidateQueries({
                queryKey: classFollowUpsQuery(classId).queryKey,
            }),
    });
}

export function useMarkFollowUp(classId: number) {
    const client = useQueryClient();

    return useMutation({
        mutationFn: ({ id, done }: { id: number; done: boolean }) =>
            api<{ followUp: FollowUp }>(
                `/api/classes/${classId}/follow-ups/${id}`,
                { method: 'PUT', body: JSON.stringify({ done }) },
            ),
        onSuccess: () =>
            client.invalidateQueries({
                queryKey: classFollowUpsQuery(classId).queryKey,
            }),
    });
}

export const studentFollowUpsQuery = (
    subject: Subject,
    cookie?: string | null,
) =>
    queryOptions({
        queryKey: ['student', 'follow-ups', subject],
        queryFn: () =>
            api<{ followUps: (OfferedFollowUp & { practice: Practice })[] }>(
                `/api/student/follow-ups?subject=${subject}`,
                { headers: headers(cookie) },
            ),
    });

export const studentFollowUpQuery = (
    followUpId: number,
    cookie?: string | null,
) =>
    queryOptions({
        queryKey: ['student', 'follow-up', followUpId],
        queryFn: () =>
            api<{
                followUp: OfferedFollowUp & { subject: Subject };
                questions: ReviewQuestion[];
            }>(`/api/student/follow-ups/${followUpId}`, {
                headers: headers(cookie),
            }),
    });

export function useFollowUpTry(followUpId: number) {
    return usePracticeTry(`/api/student/follow-ups/${followUpId}/tries`);
}

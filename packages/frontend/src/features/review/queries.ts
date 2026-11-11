import {
    queryOptions,
    useMutation,
    type UseMutationResult,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import type { BlockOf, Earned, Feedback } from '../learning-sessions/queries';

export type ReviewQuestion = {
    id: number;
    mission: string;
    content: BlockOf<'check'>['content'];
    earned: Earned;
    tries: number;
};

export const studentReviewQuery = (subject: Subject, cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'review', subject],
        queryFn: () =>
            api<{ questions: ReviewQuestion[] }>(
                `/api/student/review?subject=${subject}`,
                { headers: cookie ? { cookie } : undefined },
            ),
    });

export const studentExtraQuery = (subject: Subject, cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'extra', subject],
        queryFn: () =>
            api<{ extra: ReviewQuestion | null }>(
                `/api/student/extra?subject=${subject}`,
                { headers: cookie ? { cookie } : undefined },
            ),
    });

export type PracticeTry = {
    blockId: number;
    tryNumber: number;
    answer: { kind: 'check'; choice: string; reason?: string };
};

export type PracticeSend = UseMutationResult<Feedback, Error, PracticeTry>;

function usePracticeTry(url: string) {
    return useMutation({
        mutationFn: (input: PracticeTry) =>
            api<Feedback>(url, {
                method: 'POST',
                body: JSON.stringify(input),
            }),
    });
}

export function useReviewTry() {
    return usePracticeTry('/api/student/review/tries');
}

export function useExtraTry() {
    return usePracticeTry('/api/student/extra/tries');
}

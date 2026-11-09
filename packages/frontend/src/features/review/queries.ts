import { queryOptions, useMutation } from '@tanstack/react-query';
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

export function useReviewTry() {
    return useMutation({
        mutationFn: (input: {
            blockId: number;
            tryNumber: number;
            answer: { kind: 'check'; choice: string; reason?: string };
        }) =>
            api<Feedback>('/api/student/review/tries', {
                method: 'POST',
                body: JSON.stringify(input),
            }),
    });
}

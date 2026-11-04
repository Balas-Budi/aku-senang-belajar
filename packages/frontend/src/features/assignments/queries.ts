import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
export type Subject =
    | 'mathematics'
    | 'natural_and_social_science'
    | 'indonesian_language'
    | 'pancasila_education';
export type Assignment = {
    id: number;
    title: string;
    summary: string;
    subject: Subject;
    moduleTitle: string;
};
export const studentAssignmentsQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'assignments'],
        queryFn: () =>
            api<Assignment[]>('/api/student/assignments', {
                headers: cookie ? { cookie } : undefined,
            }),
    });

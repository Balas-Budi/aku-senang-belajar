import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Step } from '../learning-sessions/queries';
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
    progress: 'not_started' | 'in_progress' | 'submitted';
    step: Step | null;
};
export const studentAssignmentsQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'assignments'],
        queryFn: () =>
            api<Assignment[]>('/api/student/assignments', {
                headers: cookie ? { cookie } : undefined,
            }),
    });

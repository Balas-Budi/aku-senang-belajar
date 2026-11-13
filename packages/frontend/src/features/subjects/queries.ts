import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';

export const SUBJECT_COLORS = [
    'pink',
    'blue',
    'green',
    'orange',
    'purple',
] as const;
export const SUBJECT_ICONS = [
    'mathematics',
    'natural_and_social_science',
    'indonesian_language',
    'pancasila_education',
    'book',
    'globe',
    'music',
    'brush',
    'ball',
    'leaf',
    'prayer',
    'computer',
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];
export type SubjectIcon = (typeof SUBJECT_ICONS)[number];

export type SubjectInfo = {
    key: string;
    name: string;
    color: string;
    icon: string;
    builtIn: boolean;
    books: number;
};

const headers = (cookie?: string | null) => (cookie ? { cookie } : undefined);

export const subjectsQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['subjects'],
        queryFn: () =>
            api<SubjectInfo[]>('/api/subjects', { headers: headers(cookie) }),
        staleTime: 5 * 60 * 1000,
    });

export function useCreateSubject() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (input: {
            name: string;
            color: SubjectColor;
            icon: SubjectIcon;
        }) =>
            api<SubjectInfo>('/api/subjects', {
                method: 'POST',
                body: JSON.stringify(input),
            }),
        onSuccess: () => client.invalidateQueries({ queryKey: ['subjects'] }),
    });
}

export function useDeleteSubject() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (key: string) =>
            api<void>(`/api/subjects/${encodeURIComponent(key)}`, {
                method: 'DELETE',
            }),
        onSuccess: () => client.invalidateQueries({ queryKey: ['subjects'] }),
    });
}

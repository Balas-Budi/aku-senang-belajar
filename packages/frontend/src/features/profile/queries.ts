import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Interest } from './interests';
export type StudentProfile = {
    profile: { interests: Interest[]; updatedAt: string } | null;
};
export const studentProfileQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'profile'],
        queryFn: () =>
            api<StudentProfile>('/api/student/profile', {
                headers: cookie ? { cookie } : undefined,
            }),
    });
export function useSaveProfile() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (interests: Interest[]) =>
            api<StudentProfile>('/api/student/profile', {
                method: 'PUT',
                body: JSON.stringify({ interests }),
            }),
        onSuccess: (saved) =>
            client.setQueryData(studentProfileQuery().queryKey, saved),
    });
}

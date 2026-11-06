import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Subject } from '../assignments/queries';

export type Material = {
    id: number;
    title: string;
    subject: Subject;
    grade: number | null;
    prepared: boolean;
    pageCount: number;
    readablePages: number;
};

export type MaterialDetail = Material & {
    pages: { number: number; readable: boolean; snippet: string | null }[];
    modules: {
        id: number;
        title: string;
        sessions: { id: number; title: string; status: 'draft' | 'ready' }[];
    }[];
};

const headersOf = (cookie?: string | null) => (cookie ? { cookie } : undefined);

export const materialsQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['materials'],
        queryFn: () =>
            api<Material[]>('/api/materials', { headers: headersOf(cookie) }),
    });

export const materialQuery = (id: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['materials', id],
        queryFn: () =>
            api<MaterialDetail>(`/api/materials/${id}`, {
                headers: headersOf(cookie),
            }),
    });

export const pageTextQuery = (materialId: number, number: number) =>
    queryOptions({
        queryKey: ['materials', materialId, 'pages', number],
        queryFn: () =>
            api<{ number: number; text: string | null }>(
                `/api/materials/${materialId}/pages/${number}`,
            ),
        staleTime: Infinity,
    });

export function useUploadMaterial() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({
            file,
            rights,
            ...fields
        }: {
            file: File;
            title: string;
            subject: string;
            grade: string;
            rights: boolean;
        }) => {
            const params = new URLSearchParams(fields);
            if (rights) params.set('rights', '1');
            return api<MaterialDetail>(`/api/materials?${params}`, {
                method: 'POST',
                body: file,
                headers: { 'content-type': 'application/pdf' },
            });
        },
        onSuccess: (material) => {
            client.setQueryData(['materials', material.id], material);
            return client.invalidateQueries({
                queryKey: ['materials'],
                exact: true,
            });
        },
    });
}

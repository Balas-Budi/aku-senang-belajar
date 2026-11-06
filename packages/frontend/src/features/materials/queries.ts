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

export type SavedModule = {
    id: number;
    title: string;
    firstPage: number | null;
    lastPage: number | null;
    competencies: {
        id: number;
        code: string;
        description: string;
        pages: number[];
    }[];
};

export type MaterialDetail = Material & {
    pages: { number: number; readable: boolean; snippet: string | null }[];
    modules: (SavedModule & {
        sessions: { id: number; title: string; status: 'draft' | 'ready' }[];
    })[];
};

export type CompetencyDraft = {
    code: string;
    description: string;
    pages: number[];
    rubric: { visible: string[]; developing: string[]; notEnough: string[] };
};

type PageRange = { title: string; firstPage: number; lastPage: number };

export function useCompetencyDrafts(materialId: number) {
    return useMutation({
        mutationFn: (range: PageRange) =>
            api<{ competencies: CompetencyDraft[] }>(
                `/api/materials/${materialId}/competency-drafts`,
                { method: 'POST', body: JSON.stringify(range) },
            ),
    });
}

export function useSaveModule(materialId: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (module: PageRange & { competencies: CompetencyDraft[] }) =>
            api<SavedModule>(`/api/materials/${materialId}/modules`, {
                method: 'POST',
                body: JSON.stringify(module),
            }),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['materials', materialId] }),
    });
}

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

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
    archived: boolean;
    pageCount: number;
    readablePages: number;
};

export type Licence = 'own' | 'school' | 'open' | 'permission';

export type LicenceData = {
    source: string | null;
    licence: Licence | null;
    licenceNote: string | null;
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

export type Reading = {
    state: 'reading_pages' | 'outlining' | 'done' | 'failed';
    error: string | null;
    pictured: number;
    described: number;
    chapters: number | null;
};

export const readingActive = (reading: Reading) =>
    reading.state === 'reading_pages' || reading.state === 'outlining';

export type MaterialDetail = Material &
    LicenceData & {
        version: number;
        reading: Reading;
        versions: {
            version: number;
            createdAt: string;
            pageCount: number;
            readablePages: number;
            chapters: number;
        }[];
        pages: { number: number; readable: boolean; snippet: string | null }[];
        modules: (SavedModule & {
            version: number;
            madeBy: 'teacher' | 'ai';
            sessions: {
                id: number;
                title: string;
                status: 'draft' | 'ready';
                drafting: 'generating' | 'failed' | null;
                competencies: string[];
            }[];
        })[];
    };

export type MaterialChange = Partial<LicenceData> & {
    archived?: boolean;
    version?: number;
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
        refetchInterval: (query) =>
            query.state.data && readingActive(query.state.data.reading)
                ? 4_000
                : false,
    });

export const pageTextQuery = (
    materialId: number,
    number: number,
    version: number,
) =>
    queryOptions({
        queryKey: ['materials', materialId, 'pages', version, number],
        queryFn: () =>
            api<{ number: number; text: string | null; visual: string | null }>(
                `/api/materials/${materialId}/pages/${number}?version=${version}`,
            ),
        staleTime: Infinity,
    });

const pdfHeaders = { 'content-type': 'application/pdf' };

function useKeepMaterial() {
    const client = useQueryClient();
    return (material: MaterialDetail) => {
        client.setQueryData(materialQuery(material.id).queryKey, material);
        return client.invalidateQueries({
            queryKey: ['materials'],
            exact: true,
        });
    };
}

export function useUploadMaterial() {
    const keep = useKeepMaterial();
    return useMutation({
        mutationFn: ({
            file,
            rights,
            source,
            licence,
            licenceNote,
            ...fields
        }: {
            file: File;
            title: string;
            subject: string;
            grade: string;
            rights: boolean;
            source: string;
            licence: string;
            licenceNote: string;
        }) => {
            const params = new URLSearchParams(fields);
            if (rights) params.set('rights', '1');
            if (source) params.set('source', source);
            if (licence) params.set('licence', licence);
            if (licenceNote) params.set('licenceNote', licenceNote);
            return api<MaterialDetail>(`/api/materials?${params}`, {
                method: 'POST',
                body: file,
                headers: pdfHeaders,
            });
        },
        onSuccess: keep,
    });
}

export function useUploadVersion(materialId: number) {
    const keep = useKeepMaterial();
    return useMutation({
        mutationFn: (file: File) =>
            api<MaterialDetail>(`/api/materials/${materialId}/versions`, {
                method: 'POST',
                body: file,
                headers: pdfHeaders,
            }),
        onSuccess: keep,
    });
}

export function useUpdateMaterial(materialId: number) {
    const keep = useKeepMaterial();
    return useMutation({
        mutationFn: (change: MaterialChange) =>
            api<MaterialDetail>(`/api/materials/${materialId}`, {
                method: 'PUT',
                body: JSON.stringify(change),
            }),
        onSuccess: keep,
    });
}

export function useReadAgain(materialId: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: () =>
            api<{ reading: 'reading_pages' }>(
                `/api/materials/${materialId}/reading`,
                { method: 'POST' },
            ),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['materials', materialId] }),
    });
}

export function useRenameModule(materialId: number, moduleId: number) {
    const keep = useKeepMaterial();
    return useMutation({
        mutationFn: (title: string) =>
            api<MaterialDetail>(
                `/api/materials/${materialId}/modules/${moduleId}`,
                { method: 'PATCH', body: JSON.stringify({ title }) },
            ),
        onSuccess: keep,
    });
}

export function useDeleteModule(materialId: number, moduleId: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: () =>
            api<void>(`/api/materials/${materialId}/modules/${moduleId}`, {
                method: 'DELETE',
            }),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['materials', materialId] }),
    });
}

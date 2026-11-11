import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { Diagram } from '../learning-sessions/diagram';
import type { Activity } from '../learning-sessions/queries';
import type { Interest } from '../profile/interests';

export type Option = { id: string; label: string; illustration?: string };
export type Picture = {
    text: string;
    illustration?: string;
    diagram?: Diagram;
};
type Fraction = {
    numerator: number;
    denominator: number;
    numeratorNote: string;
    denominatorNote: string;
};
type CheckContent = {
    prompt: string;
    illustration?: string;
    diagram?: Diagram;
    options?: Option[];
    activity?: Activity;
    answer: string;
    reason?: { prompt: string; starters: string[] };
    praise: string;
    hints: [Picture, Picture, Picture];
    example: Picture;
    reveal: string;
};

export type StudioBlock = {
    id: number;
    position: number;
    competencies: string[];
    sourcePages: number[];
} & (
    | { kind: 'brain_game'; content: { game: 'memory_pairs' } }
    | {
          kind: 'hook';
          content: {
              prompt: string;
              illustration?: string;
              diagram?: Diagram;
              options: Option[];
          };
      }
    | {
          kind: 'story';
          content: {
              text: string;
              illustration?: string;
              diagram?: Diagram;
              fraction?: Fraction;
          };
      }
    | { kind: 'check'; content: CheckContent }
    | { kind: 'extra_challenge'; content: CheckContent }
    | {
          kind: 'challenge';
          content: {
              prompt: string;
              question: string;
              illustration?: string;
              diagram?: Diagram;
              options: Option[];
              answer: string;
              reasonStarter: string;
          };
      }
    | {
          kind: 'reflection';
          content: { topics: string[]; takeaways: string[] };
      }
);

export type Issue = {
    code:
        | 'no_draft'
        | 'missing_rubric'
        | 'untested_competency'
        | 'invalid_block'
        | 'theme_drafting'
        | 'theme_failed'
        | 'theme_mismatch'
        | 'theme_unread';
    competencies?: string[];
    blocks?: number[];
    themes?: Interest[];
};
export type StudioTheme = {
    theme: Interest;
    drafting: 'generating' | 'failed' | null;
    draftError: string | null;
    read: boolean;
    readAt: string | null;
    mismatch: boolean;
    complete: boolean;
    blocks: { id: number; content: Record<string, unknown> }[];
};
export type Warning = {
    code:
        | 'no_page_source'
        | 'unreadable_pages'
        | 'ai_diagrams'
        | 'repeats_example';
    blocks?: number[];
    pages?: number[];
};
export type ClassRef = { id: number; name: string };

export type StudioSession = {
    id: number;
    title: string;
    summary: string;
    status: 'draft' | 'ready';
    version: number;
    drafting: 'generating' | 'failed' | null;
    draftError: string | null;
    prepared: boolean;
    module: {
        id: number;
        title: string;
        firstPage: number | null;
        lastPage: number | null;
    };
    material: { id: number; title: string };
    competencies: { code: string; description: string }[];
    blocks: StudioBlock[];
    issues: Issue[];
    warnings: Warning[];
    assignedClasses: ClassRef[];
    themes: StudioTheme[];
    interests: { key: Interest; students: number }[];
};

const headersOf = (cookie?: string | null) => (cookie ? { cookie } : undefined);
const studioKey = (id: number) => ['studio', id];

const working = (session: StudioSession | undefined) =>
    session?.drafting === 'generating' ||
    (session?.themes ?? []).some(({ drafting }) => drafting === 'generating');

export const studioSessionQuery = (id: number, cookie?: string | null) =>
    queryOptions({
        queryKey: studioKey(id),
        queryFn: () =>
            api<StudioSession>(`/api/studio/sessions/${id}`, {
                headers: headersOf(cookie),
            }),
        refetchInterval: (query) => (working(query.state.data) ? 5000 : false),
    });

function useStudioSync(id: number, stale = [409]) {
    const client = useQueryClient();
    const refresh = () => client.invalidateQueries({ queryKey: studioKey(id) });
    return {
        refresh,
        refreshIfStale: (error: Error) => {
            if (error instanceof ApiError && stale.includes(error.status))
                void refresh();
        },
    };
}

const useThemeSync = (id: number) => useStudioSync(id, [404, 409]);
const themePath = (id: number, theme: Interest) =>
    `/api/studio/sessions/${id}/themes/${theme}`;
export type ThemeScreen = { blockId: number; content: Record<string, unknown> };

export function useChooseThemes(id: number) {
    const sync = useThemeSync(id);
    return useMutation({
        mutationFn: (themes: Interest[]) =>
            api<{ themes: Interest[] }>(`/api/studio/sessions/${id}/themes`, {
                method: 'POST',
                body: JSON.stringify({ themes }),
            }),
        onSuccess: sync.refresh,
        onError: sync.refreshIfStale,
    });
}

export function useEditThemeBlock(id: number, theme: Interest) {
    const sync = useThemeSync(id);
    return useMutation({
        mutationFn: (screen: ThemeScreen) =>
            api<{ theme: Interest }>(themePath(id, theme), {
                method: 'PUT',
                body: JSON.stringify(screen),
            }),
        onSuccess: sync.refresh,
        onError: sync.refreshIfStale,
    });
}

export function useMarkThemeRead(id: number, theme: Interest) {
    const sync = useThemeSync(id);
    return useMutation({
        mutationFn: (version: number) =>
            api<{ theme: Interest }>(themePath(id, theme), {
                method: 'PUT',
                body: JSON.stringify({ read: true, version }),
            }),
        onSuccess: sync.refresh,
        onError: sync.refreshIfStale,
    });
}

export function useRedraftTheme(id: number, theme: Interest) {
    const sync = useThemeSync(id);
    return useMutation({
        mutationFn: (note: string) =>
            api<{ theme: Interest }>(`${themePath(id, theme)}/draft`, {
                method: 'POST',
                body: JSON.stringify(note ? { note } : {}),
            }),
        onSuccess: sync.refresh,
        onError: sync.refreshIfStale,
    });
}

export function useRemoveTheme(id: number) {
    const sync = useThemeSync(id);
    return useMutation({
        mutationFn: (theme: Interest) =>
            api<undefined>(themePath(id, theme), { method: 'DELETE' }),
        onSuccess: sync.refresh,
        onError: sync.refreshIfStale,
    });
}

export function useCreateSession(moduleId: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (competencyIds: number[]) =>
            api<{ id: number }>(`/api/modules/${moduleId}/sessions`, {
                method: 'POST',
                body: JSON.stringify({ competencyIds }),
            }),
        onSuccess: () => client.invalidateQueries({ queryKey: ['materials'] }),
    });
}

export function useReviseSession(id: number) {
    const sync = useStudioSync(id);
    return useMutation({
        mutationFn: (note: string) =>
            api<{ id: number }>(`/api/studio/sessions/${id}/revisions`, {
                method: 'POST',
                body: JSON.stringify(note ? { note } : {}),
            }),
        onSuccess: sync.refresh,
        onError: sync.refreshIfStale,
    });
}

export function useApproveSession(id: number) {
    const client = useQueryClient();
    const sync = useStudioSync(id);
    return useMutation({
        mutationFn: (body: { acknowledged: string[]; version: number }) =>
            api<StudioSession>(`/api/studio/sessions/${id}/approval`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        onSuccess: (session) => {
            client.setQueryData(studioSessionQuery(id).queryKey, session);
            return client.invalidateQueries({ queryKey: ['materials'] });
        },
        onError: sync.refreshIfStale,
    });
}

export function useAssignSession(id: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (classIds: number[]) =>
            api<ClassRef[]>(`/api/studio/sessions/${id}/assignments`, {
                method: 'POST',
                body: JSON.stringify({ classIds }),
            }),
        onSuccess: (assignedClasses) => {
            client.setQueryData(
                studioSessionQuery(id).queryKey,
                (session) => session && { ...session, assignedClasses },
            );
            return Promise.all([
                client.invalidateQueries({ queryKey: ['classes'] }),
                client.invalidateQueries({ queryKey: ['teacher', 'overview'] }),
            ]);
        },
    });
}

export function useEditBlock(sessionId: number) {
    const sync = useStudioSync(sessionId);
    return useMutation({
        mutationFn: ({
            blockId,
            content,
        }: {
            blockId: number;
            content: Record<string, unknown>;
        }) =>
            api<{ id: number }>(
                `/api/studio/sessions/${sessionId}/blocks/${blockId}`,
                { method: 'PUT', body: JSON.stringify({ content }) },
            ),
        onSuccess: sync.refresh,
        onError: sync.refreshIfStale,
    });
}

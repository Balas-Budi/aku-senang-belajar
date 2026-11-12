import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';

export type ChallengeOption = { id: string; label: string };
export type ChallengeCount = { id: string; count: number };
export type ChallengeMode = 'solo' | 'group';
export type Given = { choice: string; reason: string };

export type TeacherChallenge = {
    id: number;
    prompt: string;
    options: ChallengeOption[];
    mode: ChallengeMode;
    state: 'open' | 'revealed' | 'closed';
    units: number;
    answered: number;
    groups: { id: number; name: string; members: string[] }[];
    counts: ChallengeCount[];
    answers: { id: number; choice: string; reason: string; shown: boolean }[];
    clusters: { label: string; note: string; answerIds: number[] }[] | null;
    createdAt: string;
};

export type ChallengeSource = {
    blockId: number;
    mission: string;
    prompt: string;
    options: ChallengeOption[];
};

export type ChallengeStart = {
    prompt: string;
    options: ChallengeOption[];
    mode: ChallengeMode;
    groupSize?: number;
};

export type ChallengeChange =
    | { action: 'reveal' | 'cluster' | 'close' }
    | { action: 'show'; answerIds: number[] };

export type StudentChallenge = {
    id: number;
    prompt: string;
    options: ChallengeOption[];
    mode: ChallengeMode;
    state: 'open' | 'revealed';
    group: { name: string; members: string[] } | null;
    answered: Given | null;
    result: {
        total: number;
        counts: ChallengeCount[];
        reasons: Given[];
    } | null;
};

const challengeUrl = (classId: number) => `/api/classes/${classId}/challenge`;

export const errorCode = (error: unknown) =>
    error instanceof ApiError ? error.body.name : null;

export const challengeConflict = (error: unknown) =>
    ['CHALLENGE_OPEN', 'CHALLENGE_STATE'].includes(errorCode(error) ?? '');

export const classChallengeQuery = (classId: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['classes', classId, 'challenge'],
        queryFn: () =>
            api<{ challenge: TeacherChallenge | null }>(challengeUrl(classId), {
                headers: cookie ? { cookie } : undefined,
            }),
        refetchInterval: (query) =>
            query.state.data?.challenge?.state === 'open' ? 3_000 : false,
    });

export const challengeSourcesQuery = (classId: number) =>
    queryOptions({
        queryKey: ['classes', classId, 'challenge', 'sources'],
        queryFn: () =>
            api<{ sources: ChallengeSource[] }>(
                `${challengeUrl(classId)}/sources`,
            ),
    });

function useChallengeWrite<Input>(
    classId: number,
    method: 'POST' | 'PUT',
    serial: boolean,
) {
    const client = useQueryClient();
    const { queryKey } = classChallengeQuery(classId);

    return useMutation({
        scope: serial ? { id: `challenge-shown-${classId}` } : undefined,
        mutationFn: (input: Input) =>
            api<{ challenge: TeacherChallenge }>(challengeUrl(classId), {
                method,
                body: JSON.stringify(input),
            }),
        onSuccess: async (data) => {
            await client.cancelQueries({ queryKey, exact: true });
            client.setQueryData(queryKey, data);
        },
        onError: () => client.invalidateQueries({ queryKey, exact: true }),
    });
}

export function useStartChallenge(classId: number) {
    return useChallengeWrite<ChallengeStart>(classId, 'POST', false);
}

export function useChallengeAction(classId: number, serial = false) {
    return useChallengeWrite<ChallengeChange>(classId, 'PUT', serial);
}

export const studentChallengeQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'challenge'],
        queryFn: () =>
            api<{ challenge: StudentChallenge | null }>(
                '/api/student/challenge',
                { headers: cookie ? { cookie } : undefined },
            ),
        refetchInterval: 5_000,
    });

export function useAnswerChallenge() {
    const client = useQueryClient();
    const { queryKey } = studentChallengeQuery();

    return useMutation({
        mutationFn: (input: Given & { challengeId: number }) =>
            api<{ answered: Given }>('/api/student/challenge/answers', {
                method: 'POST',
                body: JSON.stringify(input),
            }),
        onSuccess: async ({ answered }, { challengeId }) => {
            await client.cancelQueries({ queryKey });
            client.setQueryData(queryKey, (before) =>
                before?.challenge?.id === challengeId
                    ? { challenge: { ...before.challenge, answered } }
                    : before,
            );
        },
        onError: () => client.invalidateQueries({ queryKey }),
    });
}

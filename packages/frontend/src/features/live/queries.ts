import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { LiveSession, Step } from '../learning-sessions/queries';

export type Live = LiveSession & { startedAt: string };

export type LiveMonitor = {
    live: Live | null;
    students: {
        id: number;
        name: string;
        state: 'not_started' | 'active' | 'offline' | 'done';
        step: Step | null;
    }[];
    requests: {
        id: number;
        studentId: number;
        name: string;
        step: Step | null;
        askedAt: string;
    }[];
};

export type LiveAction =
    | { do: 'open'; mode: Live['mode']; minutes?: number }
    | { do: 'pause' | 'resume' | 'advance' | 'end' }
    | { do: 'extend'; minutes: number }
    | { do: 'helped'; helpId: number };

const liveUrl = (classId: number, assignmentId: number) =>
    `/api/classes/${classId}/assignments/${assignmentId}/live`;

export const running = (live: Live | null | undefined) =>
    live?.state === 'open' || live?.state === 'paused';

export const liveMonitorQuery = (
    classId: number,
    assignmentId: number,
    cookie?: string | null,
) =>
    queryOptions({
        queryKey: ['classes', classId, 'assignments', assignmentId, 'live'],
        queryFn: () =>
            api<LiveMonitor>(liveUrl(classId, assignmentId), {
                headers: cookie ? { cookie } : undefined,
            }),
        refetchInterval: (query) =>
            running(query.state.data?.live) ? 3_000 : false,
    });

export const liveConflict = (error: unknown) =>
    error instanceof ApiError &&
    error.status === 409 &&
    (error.body.name === 'LIVE_OPEN' || error.body.name === 'LIVE_STATE');

export function useLiveAction(classId: number, assignmentId: number) {
    const client = useQueryClient();
    const url = liveUrl(classId, assignmentId);

    return useMutation({
        mutationFn: (action: LiveAction) => {
            if (action.do === 'helped') {
                return api<unknown>(`${url}/requests/${action.helpId}`, {
                    method: 'PUT',
                });
            }
            if (action.do === 'open') {
                return api<unknown>(url, {
                    method: 'POST',
                    body: JSON.stringify({
                        mode: action.mode,
                        minutes: action.minutes,
                    }),
                });
            }
            return api<unknown>(url, {
                method: 'PUT',
                body: JSON.stringify({
                    action: action.do,
                    minutes:
                        action.do === 'extend' ? action.minutes : undefined,
                }),
            });
        },
        onSettled: () =>
            client.invalidateQueries({
                queryKey: liveMonitorQuery(classId, assignmentId).queryKey,
            }),
    });
}

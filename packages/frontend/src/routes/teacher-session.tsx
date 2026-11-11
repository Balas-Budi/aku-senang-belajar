import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { classesQuery } from '../features/classes/queries';
import { liveMonitorQuery } from '../features/live/queries';
import { sessionResultsQuery } from '../features/results/queries';
import { SessionResults } from '../features/results/session-results';
import { ApiError } from '../lib/api';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/teacher-session';

export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    const classId = Number(params.classId);
    const assignmentId = Number(params.assignmentId);

    if (
        ![classId, assignmentId].every(
            (id) => Number.isSafeInteger(id) && id > 0,
        )
    )
        throw data('Misi tidak ditemukan', { status: 404 });

    try {
        await Promise.all([
            client.prefetchQuery(classesQuery(cookie)),
            client.prefetchQuery(
                liveMonitorQuery(classId, assignmentId, cookie),
            ),
            client.fetchQuery(
                sessionResultsQuery(classId, assignmentId, cookie),
            ),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Misi tidak ditemukan', { status: 404 });
        throw error;
    }

    return { classId, assignmentId, dehydratedState: dehydrate(client) };
}

export const meta = () => [{ title: 'Hasil misi | Aku Senang Belajar' }];

export default function TeacherSession({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <SessionResults
                classId={loaderData.classId}
                assignmentId={loaderData.assignmentId}
            />
        </HydrationBoundary>
    );
}

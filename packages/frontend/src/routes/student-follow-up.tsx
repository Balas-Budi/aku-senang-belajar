import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data, isRouteErrorResponse } from 'react-router';
import {
    FollowUpGone,
    FollowUpSession,
} from '../features/follow-ups/follow-up-session';
import { studentFollowUpQuery } from '../features/follow-ups/queries';
import { ApiError } from '../lib/api';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/student-follow-up';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    const followUpId = Number(params.followUpId);
    if (!Number.isSafeInteger(followUpId) || followUpId < 1)
        throw data('Latihan tidak ditemukan', { status: 404 });
    try {
        await client.fetchQuery(studentFollowUpQuery(followUpId, cookie));
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Latihan tidak ditemukan', { status: 404 });
        throw error;
    }
    return { followUpId, dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Dari gurumu | Aku Senang Belajar' }];
export default function StudentFollowUp({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <FollowUpSession followUpId={loaderData.followUpId} />
        </HydrationBoundary>
    );
}
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    return (
        <FollowUpGone
            failed={!(isRouteErrorResponse(error) && error.status === 404)}
        />
    );
}

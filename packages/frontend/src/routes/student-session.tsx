import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data, redirect } from 'react-router';
import { ToastProvider } from '../components/ui/toast';
import { studentClassQuery } from '../features/classes/queries';
import {
    membershipInactive,
    sessionQuery,
} from '../features/learning-sessions/queries';
import { SessionPlayer } from '../features/learning-sessions/session-player';
import { SessionInactivePage } from '../features/learning-sessions/session-screens';
import { studentSettingsQuery } from '../features/settings/queries';
import { ApiError } from '../lib/api';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/student-session';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    const id = Number(params.assignmentId);
    if (!Number.isSafeInteger(id) || id < 1)
        throw data('Misi tidak ditemukan', { status: 404 });
    try {
        await Promise.all([
            client.fetchQuery(sessionQuery(id, cookie)),
            client.fetchQuery(studentClassQuery(cookie)),
            client.prefetchQuery(studentSettingsQuery(cookie)),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Misi tidak ditemukan', { status: 404 });
        if (error instanceof ApiError && error.body.name === 'STAGE_LOCKED')
            throw redirect('/student');
        if (membershipInactive(error)) {
            await client.prefetchQuery(studentSettingsQuery(cookie));
            return data(
                { id, inactive: true, dehydratedState: dehydrate(client) },
                { status: 403 },
            );
        }
        throw error;
    }
    return { id, inactive: false, dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Misi belajar | Aku Senang Belajar' }];
export default function StudentSession({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            {loaderData.inactive ? (
                <SessionInactivePage />
            ) : (
                <ToastProvider>
                    <SessionPlayer assignmentId={loaderData.id} />
                </ToastProvider>
            )}
        </HydrationBoundary>
    );
}

import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import { studioSessionQuery } from '../features/studio/queries';
import { StudioView } from '../features/studio/studio';
import { ApiError } from '../lib/api';
import type { Route } from './+types/teacher-studio';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    const id = Number(params.sessionId);
    if (!Number.isSafeInteger(id) || id < 1)
        throw data('Sesi tidak ditemukan', { status: 404 });
    try {
        await client.fetchQuery(studioSessionQuery(id, cookie));
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Sesi tidak ditemukan', { status: 404 });
        throw error;
    }
    return { id, dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Studio sesi | Aku Senang Belajar' }];
export default function Studio({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <StudioView id={loaderData.id} />
        </HydrationBoundary>
    );
}

import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { classesQuery } from '../features/classes/queries';
import { FollowUpPlan } from '../features/follow-ups/follow-up-plan';
import { classFollowUpsQuery } from '../features/follow-ups/queries';
import { ApiError } from '../lib/api';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/teacher-follow-ups';

export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    const classId = Number(params.classId);

    if (!Number.isSafeInteger(classId) || classId < 1)
        throw data('Kelas tidak ditemukan', { status: 404 });

    try {
        await Promise.all([
            client.prefetchQuery(classesQuery(cookie)),
            client.fetchQuery(classFollowUpsQuery(classId, cookie)),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Kelas tidak ditemukan', { status: 404 });
        throw error;
    }

    return { classId, dehydratedState: dehydrate(client) };
}

export const meta = () => [
    { title: 'Rencana tindak lanjut | Aku Senang Belajar' },
];

export default function TeacherFollowUps({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <FollowUpPlan classId={loaderData.classId} />
        </HydrationBoundary>
    );
}

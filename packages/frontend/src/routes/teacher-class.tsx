import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import {
    classChaptersQuery,
    classesQuery,
    classMembershipQuery,
    rosterQuery,
} from '../features/classes/queries';
import { ClassDetail } from '../features/classes/class-detail';
import { classChallengeQuery } from '../features/challenges/queries';
import { classFollowUpsQuery } from '../features/follow-ups/queries';
import { classMissionsQuery } from '../features/results/queries';
import { ApiError } from '../lib/api';
import { BackLink } from '../components/back-link';
import type { Route } from './+types/teacher-class';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    const id = Number(params.classId);
    if (!Number.isSafeInteger(id) || id < 1)
        throw data('Kelas tidak ditemukan', { status: 404 });
    try {
        await Promise.all([
            client.fetchQuery(classesQuery(cookie)),
            client.fetchQuery(rosterQuery(id, cookie)),
            client.prefetchQuery(classMissionsQuery(id, cookie)),
            client.prefetchQuery(classChaptersQuery(id, cookie)),
            client.prefetchQuery(classChallengeQuery(id, cookie)),
            client.prefetchQuery(classFollowUpsQuery(id, cookie)),
            client.prefetchQuery(classMembershipQuery(id, cookie)),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Kelas tidak ditemukan', { status: 404 });
        throw error;
    }
    return { id, dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Kelas | Aku Senang Belajar' }];
export default function Detail({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <div className="space-y-4">
                <BackLink to="/teacher/classes">
                    Kembali ke daftar kelas
                </BackLink>
                <ClassDetail id={loaderData.id} />
            </div>
        </HydrationBoundary>
    );
}

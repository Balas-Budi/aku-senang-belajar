import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data, Link } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import { classesQuery, rosterQuery } from '../features/classes/queries';
import { ClassDetail } from '../features/classes/class-detail';
import { classMissionsQuery } from '../features/results/queries';
import { ApiError } from '../lib/api';
import { textLink } from '../components/ui/text-link';
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
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Kelas tidak ditemukan', { status: 404 });
        throw error;
    }
    return { id, dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Daftar siswa | Aku Senang Belajar' }];
export default function Detail({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <Link to="/teacher/classes" className={textLink}>
                Kembali ke daftar kelas
            </Link>
            <ClassDetail id={loaderData.id} />
        </HydrationBoundary>
    );
}

import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { redirect } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import { studentAssignmentsQuery } from '../features/assignments/queries';
import { studentClassQuery } from '../features/classes/queries';
import { StudentClass } from '../features/classes/student-class';
import { studentProfileQuery } from '../features/profile/queries';
import type { Route } from './+types/student-home';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    const [saved] = await Promise.all([
        client.fetchQuery(studentProfileQuery(cookie)).catch(() => undefined),
        client.prefetchQuery(studentClassQuery(cookie)),
        client.prefetchQuery(studentAssignmentsQuery(cookie)),
    ]);
    if (saved?.profile === null) throw redirect('/student/profile');
    return { dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Kelasmu | Aku Senang Belajar' }];
export default function Home({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <StudentClass />
        </HydrationBoundary>
    );
}

import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { SubjectAdmin } from '../features/subjects/subject-admin';
import { subjectsQuery } from '../features/subjects/queries';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/admin-subjects';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'admin');
    await client.prefetchQuery(subjectsQuery(cookie));
    return { dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Mata pelajaran | Aku Senang Belajar' }];
export default function AdminSubjects({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <SubjectAdmin />
        </HydrationBoundary>
    );
}

import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireUser } from '../lib/require-user.server';
import { RoleShell } from '../components/role-shell';
import { classesQuery } from '../features/classes/queries';
import type { Route } from './+types/teacher-layout';
import { subjectsQuery } from '../features/subjects/queries';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    await client.prefetchQuery(classesQuery(cookie));
    await client.prefetchQuery(subjectsQuery(cookie));
    return { dehydratedState: dehydrate(client) };
}
export default function Layout({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <RoleShell role="teacher" />
        </HydrationBoundary>
    );
}

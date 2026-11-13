import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireUser } from '../lib/require-user.server';
import { RoleShell } from '../components/role-shell';
import { studentSettingsQuery } from '../features/settings/queries';
import { TextScale } from '../features/settings/text-scale';
import type { Route } from './+types/student-layout';
import { subjectsQuery } from '../features/subjects/queries';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    await client.prefetchQuery(studentSettingsQuery(cookie));
    await client.prefetchQuery(subjectsQuery(cookie));
    return { dehydratedState: dehydrate(client) };
}
export default function Layout({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <TextScale />
            <RoleShell role="student" />
        </HydrationBoundary>
    );
}

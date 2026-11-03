import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireUser } from '../lib/require-user.server';
import { RoleShell } from '../components/role-shell';
import type { Route } from './+types/admin-layout';
export async function loader({ request }: Route.LoaderArgs) {
    const { client } = await requireUser(request, 'admin');
    return { dehydratedState: dehydrate(client) };
}
export default function Layout({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <RoleShell role="admin" />
        </HydrationBoundary>
    );
}

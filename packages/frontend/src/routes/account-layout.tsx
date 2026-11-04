import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireUser } from '../lib/require-user.server';
import { RoleShell } from '../components/role-shell';
import type { Route } from './+types/account-layout';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, user } = await requireUser(request);
    return { role: user.role, dehydratedState: dehydrate(client) };
}
export default function AccountLayout({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <RoleShell role={loaderData.role} />
        </HydrationBoundary>
    );
}

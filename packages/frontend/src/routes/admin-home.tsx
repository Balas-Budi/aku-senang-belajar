import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireUser } from '../lib/require-user.server';
import { adminClassesQuery, usersQuery } from '../features/admin/queries';
import { Accounts } from '../features/admin/accounts';
import type { Route } from './+types/admin-home';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'admin');
    await Promise.all([
        client.prefetchQuery(usersQuery('student', cookie)),
        client.prefetchQuery(usersQuery('teacher', cookie)),
        client.prefetchQuery(adminClassesQuery(cookie)),
    ]);
    return { dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Akun sekolah | Aku Senang Belajar' }];
export default function Home({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <Accounts />
        </HydrationBoundary>
    );
}

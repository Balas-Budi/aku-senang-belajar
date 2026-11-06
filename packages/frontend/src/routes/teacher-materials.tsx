import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireUser } from '../lib/require-user.server';
import { materialsQuery } from '../features/materials/queries';
import { Library } from '../features/materials/library';
import type { Route } from './+types/teacher-materials';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    await client.prefetchQuery(materialsQuery(cookie));
    return { dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Materi | Aku Senang Belajar' }];
export default function Materials({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <Library />
        </HydrationBoundary>
    );
}

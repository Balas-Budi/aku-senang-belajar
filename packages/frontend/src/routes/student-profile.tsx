import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireUser } from '../lib/require-user.server';
import { studentProfileQuery } from '../features/profile/queries';
import { InterestPicker } from '../features/profile/interest-picker';
import type { Route } from './+types/student-profile';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    await client.prefetchQuery(studentProfileQuery(cookie));
    return { dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Minatku | Aku Senang Belajar' }];
export default function Profile({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <InterestPicker />
        </HydrationBoundary>
    );
}

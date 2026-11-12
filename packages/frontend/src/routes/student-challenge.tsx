import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { ClassChallenge } from '../features/challenges/class-challenge';
import { studentChallengeQuery } from '../features/challenges/queries';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/student-challenge';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    await client.prefetchQuery(studentChallengeQuery(cookie));
    return { dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Tantangan kelas | Aku Senang Belajar' }];
export default function StudentChallenge({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <ClassChallenge />
        </HydrationBoundary>
    );
}

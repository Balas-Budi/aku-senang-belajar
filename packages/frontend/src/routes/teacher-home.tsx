import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { requireUser } from '../lib/require-user.server';
import { classesQuery } from '../features/classes/queries';
import { TeacherClasses } from '../features/classes/teacher-classes';
import type { Route } from './+types/teacher-home';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    await client.prefetchQuery(classesQuery(cookie));
    return { dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Kelas | Aku Senang Belajar' }];
export default function Home({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <TeacherClasses />
        </HydrationBoundary>
    );
}

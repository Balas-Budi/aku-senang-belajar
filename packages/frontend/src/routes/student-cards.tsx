import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { KnowledgeCards } from '../features/cards/knowledge-cards';
import { studentCardsQuery } from '../features/cards/queries';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/student-cards';
export async function loader({ request }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    await client.prefetchQuery(studentCardsQuery(cookie));
    return { dehydratedState: dehydrate(client) };
}
export const meta = () => [
    { title: 'Kartu pengetahuanku | Aku Senang Belajar' },
];
export default function StudentCards({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <KnowledgeCards />
        </HydrationBoundary>
    );
}

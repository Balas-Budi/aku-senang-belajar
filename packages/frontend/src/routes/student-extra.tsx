import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import type { Subject } from '../features/assignments/queries';
import { subjectsQuery } from '../features/subjects/queries';
import { ExtraSession } from '../features/review/extra-session';
import { studentExtraQuery } from '../features/review/queries';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/student-extra';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    const known = (await client.fetchQuery(subjectsQuery(cookie))).find(
        ({ key }) => key === params.subject,
    );
    if (!known) throw data('Mata pelajaran tidak ditemukan', { status: 404 });
    const subject = params.subject as Subject;
    await client.prefetchQuery(studentExtraQuery(subject, cookie));
    return { subject, dehydratedState: dehydrate(client) };
}
export const meta = () => [
    { title: 'Tantangan tambahan | Aku Senang Belajar' },
];
export default function StudentExtra({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <ExtraSession subject={loaderData.subject} />
        </HydrationBoundary>
    );
}

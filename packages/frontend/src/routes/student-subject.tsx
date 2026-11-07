import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import type { Subject } from '../features/assignments/queries';
import { subjects } from '../features/assignments/subject-art';
import { studentPathQuery } from '../features/path/queries';
import { SubjectChapters } from '../features/path/subject-chapters';
import type { Route } from './+types/student-subject';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    if (!Object.hasOwn(subjects, params.subject))
        throw data('Mata pelajaran tidak ditemukan', { status: 404 });
    await client.prefetchQuery(studentPathQuery(cookie));
    return {
        subject: params.subject as Subject,
        dehydratedState: dehydrate(client),
    };
}
export const meta = ({ loaderData }: Route.MetaArgs) => [
    {
        title: `${loaderData ? subjects[loaderData.subject].label : 'Mata pelajaran'} | Aku Senang Belajar`,
    },
];
export default function StudentSubject({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <SubjectChapters subject={loaderData.subject} />
        </HydrationBoundary>
    );
}

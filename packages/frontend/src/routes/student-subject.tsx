import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import type { Subject } from '../features/assignments/queries';
import { subjects } from '../features/assignments/subject-art';
import { studentClassQuery } from '../features/classes/queries';
import { studentPathQuery } from '../features/path/queries';
import {
    studentExtraQuery,
    studentReviewQuery,
} from '../features/review/queries';
import { SubjectPath } from '../features/path/subject-path';
import type { Route } from './+types/student-subject';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    if (!Object.hasOwn(subjects, params.subject))
        throw data('Mata pelajaran tidak ditemukan', { status: 404 });
    await Promise.all([
        client.prefetchQuery(studentPathQuery(cookie)),
        client.prefetchQuery(studentClassQuery(cookie)),
        client.prefetchQuery(
            studentReviewQuery(params.subject as Subject, cookie),
        ),
        client.prefetchQuery(
            studentExtraQuery(params.subject as Subject, cookie),
        ),
    ]);
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
            <SubjectPath subject={loaderData.subject} />
        </HydrationBoundary>
    );
}

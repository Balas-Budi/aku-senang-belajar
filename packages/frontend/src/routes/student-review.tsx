import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import type { Subject } from '../features/assignments/queries';
import { subjects } from '../features/assignments/subject-art';
import { studentReviewQuery } from '../features/review/queries';
import { ReviewSession } from '../features/review/review-session';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/student-review';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    if (!Object.hasOwn(subjects, params.subject))
        throw data('Mata pelajaran tidak ditemukan', { status: 404 });
    const subject = params.subject as Subject;
    await client.prefetchQuery(studentReviewQuery(subject, cookie));
    return { subject, dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Ulang Yuk | Aku Senang Belajar' }];
export default function StudentReview({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <ReviewSession subject={loaderData.subject} />
        </HydrationBoundary>
    );
}

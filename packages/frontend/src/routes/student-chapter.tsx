import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import { studentClassQuery } from '../features/classes/queries';
import { ChapterPath } from '../features/path/chapter-path';
import { findChapter, studentPathQuery } from '../features/path/queries';
import type { Route } from './+types/student-chapter';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    const id = Number(params.chapterId);
    if (!Number.isSafeInteger(id) || id < 1)
        throw data('Bab tidak ditemukan', { status: 404 });
    const [path] = await Promise.all([
        client.fetchQuery(studentPathQuery(cookie)),
        client.prefetchQuery(studentClassQuery(cookie)),
    ]);
    const found = findChapter(path, id);
    if (!found) throw data('Bab tidak ditemukan', { status: 404 });
    return {
        id,
        title: found.chapter.title,
        dehydratedState: dehydrate(client),
    };
}
export const meta = ({ loaderData }: Route.MetaArgs) => [
    { title: `${loaderData?.title ?? 'Bab'} | Aku Senang Belajar` },
];
export default function StudentChapter({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <ChapterPath chapterId={loaderData.id} />
        </HydrationBoundary>
    );
}

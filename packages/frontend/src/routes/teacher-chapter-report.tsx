import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { classesQuery } from '../features/classes/queries';
import { ChapterReport } from '../features/reports/chapter-report';
import { chapterReportQuery } from '../features/reports/queries';
import { ApiError } from '../lib/api';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/teacher-chapter-report';

export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    const classId = Number(params.classId);
    const moduleId = Number(params.moduleId);

    if (![classId, moduleId].every((id) => Number.isSafeInteger(id) && id > 0))
        throw data('Bab tidak ditemukan', { status: 404 });

    try {
        await Promise.all([
            client.prefetchQuery(classesQuery(cookie)),
            client.fetchQuery(chapterReportQuery(classId, moduleId, cookie)),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Bab tidak ditemukan', { status: 404 });
        throw error;
    }

    return { classId, moduleId, dehydratedState: dehydrate(client) };
}

export const meta = () => [{ title: 'Laporan bab | Aku Senang Belajar' }];

export default function TeacherChapterReport({
    loaderData,
}: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <ChapterReport
                classId={loaderData.classId}
                moduleId={loaderData.moduleId}
            />
        </HydrationBoundary>
    );
}

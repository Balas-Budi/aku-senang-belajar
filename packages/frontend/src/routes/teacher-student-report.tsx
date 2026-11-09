import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { classesQuery } from '../features/classes/queries';
import { studentReportQuery } from '../features/reports/queries';
import { StudentReport } from '../features/reports/student-report';
import { ApiError } from '../lib/api';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/teacher-student-report';

export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    const classId = Number(params.classId);
    const studentId = Number(params.studentId);

    if (![classId, studentId].every((id) => Number.isSafeInteger(id) && id > 0))
        throw data('Siswa tidak ditemukan', { status: 404 });

    try {
        await Promise.all([
            client.prefetchQuery(classesQuery(cookie)),
            client.fetchQuery(studentReportQuery(classId, studentId, cookie)),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Siswa tidak ditemukan', { status: 404 });
        throw error;
    }

    return { classId, studentId, dehydratedState: dehydrate(client) };
}

export const meta = () => [{ title: 'Laporan siswa | Aku Senang Belajar' }];

export default function TeacherStudentReport({
    loaderData,
}: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <StudentReport
                classId={loaderData.classId}
                studentId={loaderData.studentId}
            />
        </HydrationBoundary>
    );
}

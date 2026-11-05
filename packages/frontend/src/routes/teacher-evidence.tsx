import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { studentEvidenceQuery } from '../features/results/queries';
import { StudentEvidence } from '../features/results/student-evidence';
import { ApiError } from '../lib/api';
import { requireUser } from '../lib/require-user.server';
import type { Route } from './+types/teacher-evidence';

export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    const ids = {
        classId: Number(params.classId),
        assignmentId: Number(params.assignmentId),
        studentId: Number(params.studentId),
    };

    if (!Object.values(ids).every((id) => Number.isSafeInteger(id) && id > 0))
        throw data('Siswa tidak ditemukan', { status: 404 });

    try {
        await client.fetchQuery(
            studentEvidenceQuery(
                ids.classId,
                ids.assignmentId,
                ids.studentId,
                cookie,
            ),
        );
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Siswa tidak ditemukan', { status: 404 });
        throw error;
    }

    return { ...ids, dehydratedState: dehydrate(client) };
}

export const meta = () => [{ title: 'Bukti siswa | Aku Senang Belajar' }];

export default function TeacherEvidence({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <StudentEvidence
                classId={loaderData.classId}
                assignmentId={loaderData.assignmentId}
                studentId={loaderData.studentId}
            />
        </HydrationBoundary>
    );
}

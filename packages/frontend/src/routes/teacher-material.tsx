import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { data } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import { materialQuery } from '../features/materials/queries';
import { MaterialDetailView } from '../features/materials/material-detail';
import { ApiError } from '../lib/api';
import type { Route } from './+types/teacher-material';
import { BackLink } from '../components/back-link';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'teacher');
    const id = Number(params.materialId);
    if (!Number.isSafeInteger(id) || id < 1)
        throw data('Materi tidak ditemukan', { status: 404 });
    try {
        await client.fetchQuery(materialQuery(id, cookie));
    } catch (error) {
        if (error instanceof ApiError && error.status === 404)
            throw data('Materi tidak ditemukan', { status: 404 });
        throw error;
    }
    return { id, dehydratedState: dehydrate(client) };
}
export const meta = () => [{ title: 'Materi | Aku Senang Belajar' }];
export default function Material({ loaderData }: Route.ComponentProps) {
    return (
        <HydrationBoundary state={loaderData.dehydratedState}>
            <BackLink to="/teacher/materials">Kembali ke Materi</BackLink>
            <MaterialDetailView id={loaderData.id} />
        </HydrationBoundary>
    );
}

import { data, redirect } from 'react-router';
import { requireUser } from '../lib/require-user.server';
import { findChapter, studentPathQuery } from '../features/path/queries';
import type { Route } from './+types/student-chapter';
export async function loader({ request, params }: Route.LoaderArgs) {
    const { client, cookie } = await requireUser(request, 'student');
    const id = Number(params.chapterId);
    const found =
        Number.isSafeInteger(id) && id > 0
            ? findChapter(await client.fetchQuery(studentPathQuery(cookie)), id)
            : null;
    if (!found) throw data('Bab tidak ditemukan', { status: 404 });
    throw redirect(`/student/subjects/${found.subject}#bab-${id}`);
}
export default function StudentChapter() {
    return null;
}

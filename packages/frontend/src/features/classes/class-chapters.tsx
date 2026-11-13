import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ErrorToast, RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import { ApiError } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import { subjects } from '../assignments/subject-art';
import {
    classChaptersQuery,
    useChapterAccess,
    type ClassBook,
} from './queries';

const refusals: Record<string, string> = {
    CHAPTER_EMPTY: 'Bab ini belum punya misi yang siap dipakai.',
    CHAPTER_STARTED:
        'Bab ini tidak bisa ditutup karena sudah ada siswa yang mulai mengerjakannya.',
};

function ChapterRow({
    classId,
    ownBookId,
    chapter,
}: {
    classId: number;
    ownBookId: number | null;
    chapter: ClassBook['chapters'][number];
}) {
    const access = useChapterAccess(classId);
    const change = (method: 'PUT' | 'DELETE') =>
        access.mutate({ chapterId: chapter.id, method });
    const refusal =
        access.error instanceof ApiError
            ? refusals[access.error.body.name]
            : undefined;
    const opened = chapter.openStages > 0;
    return (
        <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <div className="min-w-0">
                <h4 className="font-semibold break-words">{chapter.title}</h4>
                <p className="text-muted-foreground text-sm">
                    {opened
                        ? `Dibuka untuk kelas · ${chapter.openStages} misi`
                        : chapter.waitingStages > 0
                          ? `Belum dibuka · ${chapter.waitingStages} misi siap`
                          : 'Belum ada misi yang siap'}
                    {opened &&
                        chapter.waitingStages > 0 &&
                        ` · ${chapter.waitingStages} misi baru belum dibagikan`}
                    {chapter.started && ' · Siswa sudah mulai'}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {opened && (
                    <Link
                        to={`/teacher/classes/${classId}/chapters/${chapter.id}`}
                        className={buttonVariants({ variant: 'outline' })}
                    >
                        Laporan bab
                    </Link>
                )}
                {chapter.waitingStages > 0 && (
                    <Button
                        variant={opened ? 'outline' : 'primary'}
                        disabled={access.isPending}
                        onClick={() => change('PUT')}
                    >
                        {access.isPending && access.variables.method === 'PUT'
                            ? 'Membuka…'
                            : opened
                              ? 'Bagikan misi baru'
                              : 'Buka bab'}
                    </Button>
                )}
                {opened && !chapter.started && (
                    <Button
                        variant="outline"
                        disabled={access.isPending}
                        onClick={() => change('DELETE')}
                    >
                        {access.isPending &&
                        access.variables.method === 'DELETE'
                            ? 'Menutup…'
                            : 'Tutup bab'}
                    </Button>
                )}
                {!opened && chapter.waitingStages === 0 && ownBookId && (
                    <Link
                        to={`/teacher/materials/${ownBookId}`}
                        className={textLink}
                    >
                        Siapkan misi
                    </Link>
                )}
            </div>
            <ErrorToast error={access.error} message={refusal || null} />
        </li>
    );
}

export function ClassChapters({ classId }: { classId: number }) {
    const books = useQuery(classChaptersQuery(classId));
    return (
        <Card>
            <section aria-labelledby="chapters-title" className="space-y-3">
                <div>
                    <h2 id="chapters-title" className="text-lg font-semibold">
                        Bab untuk kelas ini
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Siswa hanya melihat bab yang Anda buka. Misi di dalam
                        bab terbuka satu per satu, sesuai urutan.
                    </p>
                </div>
                {books.isPending ? (
                    <p role="status">Memuat bab…</p>
                ) : books.isError ? (
                    <div className="space-y-3">
                        <RequestError error={books.error} />
                        <Button
                            onClick={() => {
                                void books.refetch();
                            }}
                        >
                            Muat ulang bab
                        </Button>
                    </div>
                ) : books.data.length === 0 ? (
                    <p>
                        Belum ada buku dengan bab. Tambahkan bab di{' '}
                        <Link to="/teacher/materials" className={textLink}>
                            pustaka materi
                        </Link>
                        .
                    </p>
                ) : (
                    (Object.keys(subjects) as Subject[]).flatMap((subject) =>
                        books.data
                            .filter((book) => book.subject === subject)
                            .map((book) => (
                                <section
                                    key={book.id}
                                    aria-labelledby={`class-book-${book.id}`}
                                >
                                    <h3
                                        id={`class-book-${book.id}`}
                                        className="font-semibold"
                                    >
                                        {book.title}
                                        <span className="text-muted-foreground font-normal">
                                            {' '}
                                            · {subjects[subject].label}
                                            {book.prepared && ' · Siap pakai'}
                                        </span>
                                    </h3>
                                    <ul className="divide-paper-edge divide-y">
                                        {book.chapters.map((chapter) => (
                                            <ChapterRow
                                                key={chapter.id}
                                                classId={classId}
                                                ownBookId={
                                                    book.prepared
                                                        ? null
                                                        : book.id
                                                }
                                                chapter={chapter}
                                            />
                                        ))}
                                    </ul>
                                </section>
                            )),
                    )
                )}
            </section>
        </Card>
    );
}

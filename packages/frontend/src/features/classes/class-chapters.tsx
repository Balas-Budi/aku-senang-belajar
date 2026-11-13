import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ErrorToast, RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import { ApiError } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import {
    SubjectArt,
    SubjectName,
    useSubjects,
} from '../assignments/subject-art';
import { SectionTitle } from '../../components/section-title';
import { BookIcon } from '../../components/icons/workspace-icons';
import { cn } from '../../lib/cn';
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
    number,
}: {
    classId: number;
    ownBookId: number | null;
    chapter: ClassBook['chapters'][number];
    number: number;
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
        <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
            <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
                <span
                    aria-hidden="true"
                    className="bg-secondary text-primary-deep flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                >
                    {number}
                </span>
                <div className="min-w-0">
                    <h4 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold break-words">
                        {chapter.title}
                        <span
                            className={cn(
                                'rounded-full px-2.5 py-0.5 text-sm font-semibold',
                                opened
                                    ? 'bg-status-visible/10 text-status-visible'
                                    : chapter.waitingStages > 0
                                      ? 'bg-secondary text-ai-suggestion'
                                      : 'bg-muted text-muted-foreground',
                            )}
                        >
                            {opened
                                ? 'Dibuka'
                                : chapter.waitingStages > 0
                                  ? 'Siap dibuka'
                                  : 'Belum ada misi'}
                        </span>
                    </h4>
                    <p className="text-muted-foreground text-sm">
                        {opened
                            ? `Dibuka untuk kelas · ${chapter.openStages} misi`
                            : chapter.waitingStages > 0
                              ? `${chapter.waitingStages} misi siap dibagikan`
                              : 'Siapkan misinya dulu di Materi.'}
                        {opened &&
                            chapter.waitingStages > 0 &&
                            ` · ${chapter.waitingStages} misi baru belum dibagikan`}
                        {chapter.started && ' · Siswa sudah mulai'}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {opened && (
                    <Link
                        to={`/teacher/classes/${classId}/chapters/${chapter.id}`}
                        className={buttonVariants({
                            variant: 'outline',
                            className: 'min-h-11 bg-white px-4',
                        })}
                    >
                        Laporan bab
                    </Link>
                )}
                {chapter.waitingStages > 0 && (
                    <Button
                        variant={opened ? 'outline' : 'primary'}
                        className="min-h-11 px-4"
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
                        className="min-h-11 bg-white px-4"
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
                        className={buttonVariants({
                            variant: 'outline',
                            className: 'min-h-11 bg-white px-4',
                        })}
                    >
                        Siapkan misi
                    </Link>
                )}
            </div>
            <ErrorToast error={access.error} message={refusal || null} />
        </li>
    );
}

function BookItem({
    classId,
    book,
    open,
    onToggle,
}: {
    classId: number;
    book: ClassBook;
    open: boolean;
    onToggle: () => void;
}) {
    const opened = book.chapters.filter(
        ({ openStages }) => openStages > 0,
    ).length;
    const ready = book.chapters.filter(
        ({ openStages, waitingStages }) =>
            openStages === 0 && waitingStages > 0,
    ).length;
    const bodyId = `class-book-${book.id}`;
    return (
        <li className="border-paper-edge overflow-hidden rounded-2xl border bg-white">
            <h3>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={onToggle}
                    className="hover:bg-student-surface focus-visible:outline-ring flex w-full items-center gap-3 p-4 text-left focus-visible:outline-3 focus-visible:-outline-offset-3 sm:gap-4"
                >
                    <SubjectArt
                        subject={book.subject}
                        className="size-10 shrink-0 sm:size-12"
                    />
                    <span className="min-w-0 flex-1">
                        <span className="font-display text-primary-deep block text-lg leading-tight font-semibold break-words sm:text-xl">
                            {book.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-muted-foreground text-sm">
                                <SubjectName subject={book.subject} /> ·{' '}
                                {book.chapters.length} bab
                                {book.prepared && ' · Siap pakai'}
                            </span>
                            <span
                                className={cn(
                                    'rounded-full px-2.5 py-0.5 text-sm font-semibold',
                                    opened > 0
                                        ? 'bg-status-visible/10 text-status-visible'
                                        : 'bg-muted text-muted-foreground',
                                )}
                            >
                                {opened > 0
                                    ? `${opened} bab dibuka`
                                    : 'Belum ada bab dibuka'}
                            </span>
                            {ready > 0 && (
                                <span className="bg-secondary text-ai-suggestion rounded-full px-2.5 py-0.5 text-sm font-semibold">
                                    {ready} siap dibuka
                                </span>
                            )}
                        </span>
                    </span>
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn(
                            'text-primary size-6 shrink-0 transition-transform motion-reduce:transition-none',
                            open && 'rotate-180',
                        )}
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </button>
            </h3>
            <ul
                id={bodyId}
                hidden={!open}
                className="border-paper-edge divide-paper-edge divide-y border-t px-4"
            >
                {book.chapters.map((chapter, index) => (
                    <ChapterRow
                        key={chapter.id}
                        number={index + 1}
                        classId={classId}
                        ownBookId={book.prepared ? null : book.id}
                        chapter={chapter}
                    />
                ))}
            </ul>
        </li>
    );
}

const rank = (order: string[], key: string) => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
};

export function ClassChapters({ classId }: { classId: number }) {
    const books = useQuery(classChaptersQuery(classId));
    const [open, setOpen] = useState<Set<number>>(() => new Set());
    const order = useSubjects().list.map(({ key }) => key);
    const ordered = [...(books.data ?? [])].sort(
        (a, b) => rank(order, a.subject) - rank(order, b.subject),
    );
    const allOpen =
        ordered.length > 0 && ordered.every(({ id }) => open.has(id));
    return (
        <Card>
            <section aria-labelledby="chapters-title" className="space-y-3">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <SectionTitle
                            id="chapters-title"
                            icon={<BookIcon />}
                            className="min-w-0"
                        >
                            Bab untuk kelas ini
                        </SectionTitle>
                        {ordered.length > 1 && (
                            <Button
                                variant="outline"
                                className="min-h-11 shrink-0 px-3 sm:px-4"
                                onClick={() =>
                                    setOpen(
                                        allOpen
                                            ? new Set()
                                            : new Set(
                                                  ordered.map(({ id }) => id),
                                              ),
                                    )
                                }
                            >
                                {allOpen ? 'Tutup semua' : 'Buka semua'}
                            </Button>
                        )}
                    </div>
                    <p className="text-muted-foreground text-base">
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
                    <>
                        <ul className="space-y-3">
                            {ordered.map((book) => (
                                <BookItem
                                    key={book.id}
                                    classId={classId}
                                    book={book}
                                    open={open.has(book.id)}
                                    onToggle={() =>
                                        setOpen((current) => {
                                            const next = new Set(current);
                                            if (!next.delete(book.id))
                                                next.add(book.id);
                                            return next;
                                        })
                                    }
                                />
                            ))}
                        </ul>
                    </>
                )}
            </section>
        </Card>
    );
}

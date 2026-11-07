import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CheckIcon } from '../../components/icons/check-icon';
import { LockIcon } from '../../components/icons/lock-icon';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { textLink } from '../../components/ui/text-link';
import { cn } from '../../lib/cn';
import type { Subject } from '../assignments/queries';
import { SubjectArt, subjects } from '../assignments/subject-art';
import {
    chaptersOf,
    finished,
    studentPathQuery,
    type Chapter,
} from './queries';
import { StageBar } from './stage-bar';

function ChapterRow({ chapter, number }: { chapter: Chapter; number: number }) {
    const done =
        chapter.stages.length > 0 &&
        finished(chapter.stages) === chapter.stages.length;
    if (!chapter.open)
        return (
            <li className="border-paper-edge bg-student-surface flex items-center gap-4 rounded-2xl border-2 border-dashed p-4">
                <span className="bg-secondary text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-full">
                    <LockIcon className="size-7" />
                </span>
                <span className="min-w-0">
                    <span className="text-muted-foreground block text-base">
                        Bab {number}
                    </span>
                    <span className="font-display text-primary-deep block text-xl leading-snug font-semibold break-words">
                        {chapter.title}
                    </span>
                    <span className="text-muted-foreground block text-base">
                        Belum dibuka gurumu
                    </span>
                </span>
            </li>
        );
    return (
        <li>
            <Link
                to={`/student/chapters/${chapter.id}`}
                className="border-paper-edge hover:bg-student-surface focus-visible:outline-ring flex items-center gap-4 rounded-2xl border-2 border-b-[5px] bg-white p-4 transition-colors focus-visible:outline-3 focus-visible:outline-offset-2"
            >
                <span
                    className={cn(
                        'font-display flex size-14 shrink-0 items-center justify-center rounded-full text-2xl font-semibold',
                        done
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-primary-deep',
                    )}
                >
                    {done ? <CheckIcon className="size-8" /> : number}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="text-muted-foreground block text-base">
                        Bab {number}
                        {done && ' · Selesai'}
                    </span>
                    <span className="font-display text-primary-deep block text-xl leading-snug font-semibold break-words">
                        {chapter.title}
                    </span>
                    <StageBar stages={chapter.stages} className="mt-1" />
                </span>
            </Link>
        </li>
    );
}

export function SubjectChapters({ subject }: { subject: Subject }) {
    const query = useQuery(studentPathQuery());
    const { label, tint } = subjects[subject];
    if (query.isPending)
        return (
            <p role="status" className="text-muted-foreground">
                Sebentar, kita ambil bab {label}…
            </p>
        );
    if (query.isError)
        return (
            <div className="space-y-3">
                <RequestError error={query.error} />
                <Button
                    feel="chunky"
                    onClick={() => {
                        void query.refetch();
                    }}
                >
                    Muat ulang bab
                </Button>
            </div>
        );
    const chapters = chaptersOf(query.data, subject) ?? [];
    const books = [...new Set(chapters.map(({ book }) => book))];
    return (
        <div className="space-y-6">
            <Link to="/student" className={textLink}>
                Kembali ke beranda
            </Link>
            <header
                className={cn(
                    'border-primary-deep/10 flex items-center gap-4 rounded-[24px] border-2 p-5 sm:gap-6 sm:p-7',
                    tint,
                )}
            >
                <SubjectArt
                    subject={subject}
                    className="size-16 bg-white sm:size-20"
                />
                <div className="min-w-0">
                    <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                        {label}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Pilih bab yang sudah dibuka gurumu.
                    </p>
                </div>
            </header>
            {books.length === 0 ? (
                <p className="bg-student-accent-soft rounded-2xl p-4 text-lg leading-relaxed sm:p-5">
                    Belum ada bab {label} yang dibuka. Coba lihat mata pelajaran
                    lain di beranda.
                </p>
            ) : (
                books.map((book, index) => (
                    <section
                        key={book}
                        aria-labelledby={`book-${index}`}
                        className="space-y-3"
                    >
                        <h2
                            id={`book-${index}`}
                            className="font-display text-primary-deep text-xl font-semibold"
                        >
                            {book}
                        </h2>
                        <ol className="space-y-3">
                            {chapters
                                .filter((chapter) => chapter.book === book)
                                .map((chapter, number) => (
                                    <ChapterRow
                                        key={chapter.id}
                                        chapter={chapter}
                                        number={number + 1}
                                    />
                                ))}
                        </ol>
                    </section>
                ))
            )}
        </div>
    );
}

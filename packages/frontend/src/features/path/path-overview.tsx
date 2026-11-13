import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import {
    SubjectArt,
    SubjectName,
    useSubjects,
} from '../assignments/subject-art';
import type { Subject } from '../assignments/queries';
import {
    chaptersOf,
    currentStage,
    finished,
    studentPathQuery,
    type LearningPath,
} from './queries';

function SubjectTile({
    subject,
    path,
}: {
    subject: Subject;
    path: LearningPath;
}) {
    const chapters = chaptersOf(path, subject) ?? [];
    const open = chapters.filter((chapter) => chapter.open);
    const stages = open.flatMap((chapter) => chapter.stages);
    const current = currentStage(chapters);
    const content = (
        <>
            <SubjectArt
                subject={subject}
                className={cn('size-14', open.length === 0 && 'opacity-60')}
            />
            <span className="min-w-0">
                <span className="font-display text-primary-deep block text-xl leading-snug font-semibold">
                    <SubjectName subject={subject} />
                </span>
                <span className="text-muted-foreground block text-base">
                    {open.length === 0
                        ? 'Belum ada bab yang dibuka'
                        : `${finished(stages)} dari ${stages.length} misi selesai`}
                </span>
            </span>
        </>
    );
    if (open.length === 0)
        return (
            <li className="border-paper-edge flex items-center gap-3 rounded-2xl border-2 border-dashed p-3">
                {content}
            </li>
        );
    return (
        <li>
            <Link
                to={
                    current
                        ? `/student/subjects/${subject}#bab-${current.chapter.id}`
                        : `/student/subjects/${subject}`
                }
                className="border-paper-edge hover:bg-student-surface focus-visible:outline-ring flex items-center gap-3 rounded-2xl border-2 border-b-[5px] bg-white p-3 transition-colors focus-visible:outline-3 focus-visible:outline-offset-2"
            >
                {content}
            </Link>
        </li>
    );
}

export function PathOverview({ teacherName }: { teacherName: string }) {
    const query = useQuery(studentPathQuery());
    const allSubjects = useSubjects().list;
    if (query.isPending)
        return (
            <p role="status" className="text-muted-foreground text-base">
                Sebentar, kita ambil jalur belajarmu…
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
                    Muat ulang jalur belajar
                </Button>
            </div>
        );
    const path = query.data;
    if (path.subjects.length === 0)
        return (
            <div className="bg-student-accent-soft rounded-2xl p-4 sm:p-5">
                <h4 className="font-display text-primary-deep text-lg font-semibold">
                    Belum ada bab yang dibuka
                </h4>
                <p className="text-muted-foreground mt-1 text-base leading-relaxed">
                    Saat {teacherName} membuka bab, misinya muncul di sini.
                </p>
            </div>
        );
    return (
        <section aria-labelledby="subjects-title" className="space-y-3">
            <h4
                id="subjects-title"
                className="font-display text-primary-deep text-xl font-semibold"
            >
                Mata pelajaran
            </h4>
            <ul className="grid gap-3 sm:grid-cols-2">
                {allSubjects
                    .filter(
                        ({ key, builtIn }) =>
                            builtIn || (chaptersOf(path, key)?.length ?? 0) > 0,
                    )
                    .map(({ key: subject }) => (
                        <SubjectTile
                            key={subject}
                            subject={subject}
                            path={path}
                        />
                    ))}
            </ul>
        </section>
    );
}

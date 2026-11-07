import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { SubjectArt, subjects } from '../assignments/subject-art';
import type { Subject } from '../assignments/queries';
import { stepLabels } from '../learning-sessions/steps';
import {
    chaptersOf,
    finished,
    studentPathQuery,
    type LearningPath,
} from './queries';

function ContinueCard({ next }: { next: NonNullable<LearningPath['next']> }) {
    const { stage } = next;
    const started = stage.progress === 'in_progress';
    return (
        <section
            aria-labelledby="next-title"
            className={cn(
                'border-primary-deep/10 flex flex-col gap-4 rounded-2xl border-2 border-b-[5px] p-4 sm:flex-row sm:items-center sm:p-5',
                subjects[next.subject].tint,
            )}
        >
            <SubjectArt
                subject={next.subject}
                className="size-16 bg-white sm:size-24"
            />
            <div className="min-w-0">
                <p className="text-base">
                    <span className="text-primary-deep font-bold">
                        {subjects[next.subject].label}
                    </span>{' '}
                    <span className="text-muted-foreground">
                        · Bab {next.chapterTitle}
                    </span>
                </p>
                <h4
                    id="next-title"
                    className="font-display text-primary-deep mt-1 text-2xl leading-tight font-semibold break-words sm:text-3xl"
                >
                    {stage.title}
                </h4>
                <p className="mt-2 text-lg leading-relaxed">{stage.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Link
                        to={`/student/sessions/${stage.id}`}
                        className={buttonVariants({ feel: 'chunky' })}
                    >
                        {started ? 'Lanjutkan misi' : 'Mulai misi'}
                    </Link>
                    {started && stage.step && (
                        <span className="text-muted-foreground">
                            Kamu berhenti di {stepLabels[stage.step]}
                        </span>
                    )}
                </div>
            </div>
        </section>
    );
}

function SubjectTile({
    subject,
    path,
}: {
    subject: Subject;
    path: LearningPath;
}) {
    const open = (chaptersOf(path, subject) ?? []).filter(
        (chapter) => chapter.open,
    );
    const stages = open.flatMap((chapter) => chapter.stages);
    const content = (
        <>
            <SubjectArt
                subject={subject}
                className={cn('size-14', open.length === 0 && 'opacity-60')}
            />
            <span className="min-w-0">
                <span className="font-display text-primary-deep block text-xl leading-snug font-semibold">
                    {subjects[subject].label}
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
                to={`/student/subjects/${subject}`}
                className="border-paper-edge hover:bg-student-surface focus-visible:outline-ring flex items-center gap-3 rounded-2xl border-2 border-b-[5px] bg-white p-3 transition-colors focus-visible:outline-3 focus-visible:outline-offset-2"
            >
                {content}
            </Link>
        </li>
    );
}

export function PathOverview({ teacherName }: { teacherName: string }) {
    const query = useQuery(studentPathQuery());
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
        <div className="space-y-6">
            {path.next ? (
                <ContinueCard next={path.next} />
            ) : (
                <p className="bg-student-surface rounded-2xl p-4 text-lg leading-relaxed sm:p-5">
                    Semua misi yang dibuka sudah selesai. Tunggu bab berikutnya
                    dari {teacherName}, ya.
                </p>
            )}
            <section aria-labelledby="subjects-title" className="space-y-3">
                <h4
                    id="subjects-title"
                    className="font-display text-primary-deep text-xl font-semibold"
                >
                    Mata pelajaran
                </h4>
                <ul className="grid gap-3 sm:grid-cols-2">
                    {(Object.keys(subjects) as Subject[]).map((subject) => (
                        <SubjectTile
                            key={subject}
                            subject={subject}
                            path={path}
                        />
                    ))}
                </ul>
            </section>
        </div>
    );
}

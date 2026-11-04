import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { studentAssignmentsQuery, type Assignment } from './queries';
import { SubjectArt, subjects } from './subject-art';
import { Button, buttonVariants } from '../../components/ui/button';
import { RequestError } from '../../components/request-error';
import { stepLabels } from '../learning-sessions/steps';
import { cn } from '../../lib/cn';
function progressOf(assignment: Assignment) {
    if (assignment.progress === 'submitted')
        return { action: 'Lihat lagi', note: 'Sudah selesai' };
    if (assignment.progress === 'in_progress')
        return {
            action: 'Lanjutkan',
            note: assignment.step
                ? `Kamu berhenti di ${stepLabels[assignment.step]}`
                : null,
        };
    return { action: 'Mulai misi', note: null };
}
function MissionLink({
    assignment,
    className,
}: {
    assignment: Assignment;
    className?: string;
}) {
    const { action, note } = progressOf(assignment);
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-2',
                className,
            )}
        >
            <Link
                to={`/student/sessions/${assignment.id}`}
                aria-label={`${action}: ${assignment.title}`}
                className={buttonVariants({
                    variant:
                        assignment.progress === 'submitted'
                            ? 'outline'
                            : 'primary',
                    feel: 'chunky',
                })}
            >
                {action}
            </Link>
            {note && <span className="text-muted-foreground">{note}</span>}
        </div>
    );
}
export function AssignmentList({ teacherName }: { teacherName: string }) {
    const query = useQuery(studentAssignmentsQuery());
    if (query.isPending)
        return (
            <p role="status" className="text-muted-foreground text-base">
                Sebentar, kita ambil misi belajarmu…
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
                    Muat ulang misi
                </Button>
            </div>
        );
    const [next, ...others] = query.data;
    if (!next)
        return (
            <div className="bg-student-accent-soft flex items-start gap-4 rounded-2xl p-4 sm:p-5">
                <svg
                    aria-hidden="true"
                    viewBox="0 0 48 48"
                    className="text-student-accent-ink size-12 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M11 8h28v33H11z" fill="white" />
                    <path d="M9 8H6v33h5M18 17h14m-14 7h14m-14 7h8" />
                    <path
                        d="m34 4 7 5-13 18-8 3 1-8L34 4Z"
                        fill="var(--color-activity-orange)"
                    />
                </svg>
                <div>
                    <h4 className="font-display text-primary-deep text-lg font-semibold">
                        Belum ada misi belajar
                    </h4>
                    <p className="text-muted-foreground mt-1 text-base leading-relaxed">
                        Saat {teacherName} membagikan misi, kamu bisa mulai dari
                        sini.
                    </p>
                </div>
            </div>
        );
    return (
        <section aria-labelledby="assignments-title" className="space-y-3">
            <h4
                id="assignments-title"
                className="font-display text-primary-deep text-xl font-semibold"
            >
                Misi belajarmu
            </h4>
            <ul className="grid gap-3 sm:grid-cols-2">
                <li
                    className={cn(
                        'border-primary-deep/10 flex flex-col gap-4 rounded-2xl border-2 border-b-[5px] p-4 sm:col-span-2 sm:flex-row sm:items-center sm:p-5',
                        subjects[next.subject].tint,
                    )}
                >
                    <SubjectArt
                        subject={next.subject}
                        className="size-16 bg-white sm:size-24"
                    />
                    <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 text-base">
                            <span className="text-primary-deep font-bold">
                                {subjects[next.subject].label}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="text-muted-foreground">
                                Bab {next.moduleTitle}
                            </span>
                        </p>
                        <h5 className="font-display text-primary-deep mt-1 text-2xl leading-tight font-semibold break-words sm:text-3xl">
                            {next.title}
                        </h5>
                        <p className="mt-2 text-lg leading-relaxed">
                            {next.summary}
                        </p>
                        <MissionLink assignment={next} className="mt-4" />
                    </div>
                </li>
                {others.map((assignment) => (
                    <li
                        key={assignment.id}
                        className="border-paper-edge flex flex-col gap-3 rounded-2xl border-2 border-b-[5px] p-3"
                    >
                        <div className="flex items-center gap-3">
                            <SubjectArt
                                subject={assignment.subject}
                                className="size-14"
                            />
                            <div className="min-w-0">
                                <h5 className="font-display text-primary-deep text-lg leading-snug font-semibold break-words">
                                    {assignment.title}
                                </h5>
                                <p className="text-muted-foreground text-base">
                                    {subjects[assignment.subject].label} · Bab{' '}
                                    {assignment.moduleTitle}
                                </p>
                            </div>
                        </div>
                        <MissionLink
                            assignment={assignment}
                            className="mt-auto"
                        />
                    </li>
                ))}
            </ul>
        </section>
    );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CheckIcon } from '../../components/icons/check-icon';
import { LockIcon } from '../../components/icons/lock-icon';
import { JalakBali } from '../../components/jalak-bali';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { textLink } from '../../components/ui/text-link';
import { cn } from '../../lib/cn';
import { SubjectArt, subjects } from '../assignments/subject-art';
import { studentClassQuery } from '../classes/queries';
import { stepLabels } from '../learning-sessions/steps';
import { findChapter, finished, studentPathQuery, type Stage } from './queries';
import { StageBar } from './stage-bar';

const lanes = [50, 70, 50, 30];
const nodeY = 25;

function statusOf(stage: Stage) {
    if (stage.progress === 'submitted') return 'Selesai';
    if (stage.locked) return 'Terkunci';
    if (stage.progress === 'in_progress')
        return stage.step
            ? `Lanjut dari ${stepLabels[stage.step]}`
            : 'Lanjutkan';
    return 'Siap dimulai';
}

function Trail({ stages }: { stages: Stage[] }) {
    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            viewBox={`0 0 100 ${stages.length * 100}`}
            preserveAspectRatio="none"
        >
            {stages.slice(1).map((stage, index) => {
                const x1 = lanes[index % lanes.length];
                const x2 = lanes[(index + 1) % lanes.length];
                const y1 = index * 100 + nodeY;
                const y2 = y1 + 100;
                return (
                    <path
                        key={stage.id}
                        d={`M${x1} ${y1}C${x1} ${y1 + 55} ${x2} ${y2 - 55} ${x2} ${y2}`}
                        fill="none"
                        stroke={
                            stages[index].progress === 'submitted'
                                ? 'var(--color-primary)'
                                : 'var(--color-border)'
                        }
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray="0.1 16"
                        vectorEffect="non-scaling-stroke"
                    />
                );
            })}
        </svg>
    );
}

function Node({
    stage,
    number,
    lane,
    current,
}: {
    stage: Stage;
    number: number;
    lane: number;
    current: boolean;
}) {
    const done = stage.progress === 'submitted';
    const circle = (
        <span className="relative">
            <span
                className={cn(
                    'font-display flex size-20 items-center justify-center rounded-full text-3xl font-semibold transition-[translate,box-shadow] duration-100',
                    done &&
                        'bg-primary text-primary-foreground shadow-[0_5px_0_var(--color-primary-shade)] group-active:translate-y-1 group-active:shadow-none',
                    !done &&
                        !stage.locked &&
                        'border-primary text-primary border-4 bg-white shadow-[0_5px_0_var(--color-primary-shade)] group-active:translate-y-1 group-active:shadow-none',
                    stage.locked &&
                        'border-paper-edge bg-secondary text-muted-foreground border-2',
                )}
            >
                {done ? (
                    <CheckIcon className="size-10" strokeWidth={2.6} />
                ) : stage.locked ? (
                    <LockIcon className="size-8" />
                ) : (
                    <span aria-hidden="true">{number}</span>
                )}
            </span>
            {current && (
                <JalakBali
                    className={cn(
                        'absolute top-1 w-14',
                        lane > 50 ? 'right-full mr-2' : 'left-full ml-2',
                    )}
                />
            )}
        </span>
    );
    const label = (
        <>
            {circle}
            <span className="bg-student-surface mt-2 flex flex-col items-center rounded-xl px-2 py-1">
                <span className="font-display text-primary-deep line-clamp-3 text-lg leading-snug font-semibold break-words">
                    <span className="sr-only">Misi {number}: </span>
                    {stage.title}
                </span>
                <span
                    className={cn(
                        'text-base',
                        current
                            ? 'text-primary font-bold'
                            : 'text-muted-foreground',
                    )}
                >
                    {statusOf(stage)}
                </span>
            </span>
        </>
    );
    const place =
        'absolute top-2 flex w-[56%] -translate-x-1/2 flex-col items-center p-1 text-center';
    return (
        <li className="relative h-52">
            {stage.locked ? (
                <div className={place} style={{ left: `${lane}%` }}>
                    {label}
                </div>
            ) : (
                <Link
                    to={`/student/sessions/${stage.id}`}
                    className={cn(
                        place,
                        'group focus-visible:outline-ring rounded-2xl focus-visible:outline-3',
                    )}
                    style={{ left: `${lane}%` }}
                >
                    {label}
                </Link>
            )}
        </li>
    );
}

export function ChapterPath({ chapterId }: { chapterId: number }) {
    const query = useQuery(studentPathQuery());
    const classroom = useQuery(studentClassQuery());
    if (query.isPending)
        return (
            <p role="status" className="text-muted-foreground">
                Sebentar, kita siapkan jalur babmu…
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
    const found = findChapter(query.data, chapterId);
    if (!found)
        return (
            <div className="space-y-4">
                <p className="text-lg">Bab ini tidak ada di kelasmu.</p>
                <Link to="/student" className={textLink}>
                    Kembali ke beranda
                </Link>
            </div>
        );
    const { subject, chapter, number } = found;
    const { stages } = chapter;
    const current = stages.find(
        (stage) => stage.progress !== 'submitted' && !stage.locked,
    );
    const teacher = classroom.data?.classroom?.teacherName ?? 'gurumu';
    return (
        <div className="space-y-6">
            <Link to={`/student/subjects/${subject}`} className={textLink}>
                Kembali ke {subjects[subject].label}
            </Link>
            <header className="border-paper-edge flex items-center gap-4 rounded-[24px] border-2 border-b-[6px] bg-white p-5 sm:gap-6 sm:p-7">
                <SubjectArt subject={subject} className="size-16 sm:size-20" />
                <div className="min-w-0">
                    <p className="text-muted-foreground text-base">
                        {subjects[subject].label} · Bab {number}
                    </p>
                    <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                        {chapter.title}
                    </h1>
                    {chapter.open && (
                        <StageBar stages={stages} className="mt-2" />
                    )}
                </div>
            </header>
            {!chapter.open ? (
                <p className="bg-student-accent-soft rounded-2xl p-4 text-lg leading-relaxed sm:p-5">
                    Bab ini belum dibuka. Saat {teacher} membukanya, misinya
                    muncul di sini.
                </p>
            ) : (
                <>
                    <ol
                        aria-label={`Misi di bab ${chapter.title}`}
                        className="relative mx-auto max-w-lg"
                    >
                        <Trail stages={stages} />
                        {stages.map((stage, index) => (
                            <Node
                                key={stage.id}
                                stage={stage}
                                number={index + 1}
                                lane={lanes[index % lanes.length]}
                                current={stage === current}
                            />
                        ))}
                    </ol>
                    {finished(stages) === stages.length && (
                        <p className="bg-student-surface border-paper-edge rounded-2xl border-2 p-4 text-center text-lg leading-relaxed sm:p-5">
                            Semua misi di bab ini sudah selesai. Tunggu bab
                            berikutnya dari {teacher}, ya.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

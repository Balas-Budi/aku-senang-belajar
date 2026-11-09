import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { CheckIcon } from '../../components/icons/check-icon';
import { LockIcon } from '../../components/icons/lock-icon';
import { JalakBali } from '../../components/jalak-bali';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { textLink } from '../../components/ui/text-link';
import { cn } from '../../lib/cn';
import { SubjectArt, subjects } from '../assignments/subject-art';
import { studentClassQuery } from '../classes/queries';
import { stepLabels } from '../learning-sessions/steps';
import { findChapter, finished, studentPathQuery, type Stage } from './queries';
import { StageBar } from './stage-bar';

const lanes = [50, 70, 50, 30];
const nodeY = 50;

function statusOf(stage: Stage) {
    if (stage.progress === 'submitted') return 'Selesai';
    if (stage.locked) return 'Terkunci';
    if (stage.progress === 'in_progress')
        return stage.step
            ? `Lanjut dari ${stepLabels[stage.step]}`
            : 'Lanjutkan';
    return 'Siap dimulai';
}

function actionOf(stage: Stage) {
    if (stage.progress === 'submitted') return 'Lihat lagi';
    if (stage.progress === 'in_progress') return 'Lanjutkan misi';
    return 'Mulai misi';
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

function Mission({
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
    const status = statusOf(stage);
    const panel = useRef<HTMLDivElement>(null);
    return (
        <li className="relative h-32 sm:h-40">
            <details
                name="mission-path"
                onToggle={(event) => {
                    const element = panel.current;
                    if (!event.currentTarget.open || !element) return;
                    element.style.setProperty('--shift', '0px');
                    const box = element.getBoundingClientRect();
                    const edge = 16;
                    const room = document.documentElement.clientWidth - edge;
                    element.style.setProperty(
                        '--shift',
                        `${Math.max(edge - box.left, 0) - Math.max(box.right - room, 0)}px`,
                    );
                    const still = matchMedia(
                        '(prefers-reduced-motion: reduce)',
                    ).matches;
                    element.scrollIntoView({
                        block: 'nearest',
                        behavior: still ? 'auto' : 'smooth',
                    });
                }}
            >
                <summary
                    aria-label={`Misi ${number}: ${stage.title}, ${status}`}
                    className={cn(
                        'font-display focus-visible:outline-ring absolute top-6 flex size-20 -translate-x-1/2 cursor-pointer list-none items-center justify-center rounded-full text-3xl font-semibold transition-[translate,box-shadow] duration-100 focus-visible:outline-3 focus-visible:outline-offset-4 active:translate-y-1 active:shadow-none sm:size-28 sm:text-4xl [&::-webkit-details-marker]:hidden',
                        done &&
                            'bg-primary text-primary-foreground shadow-[0_5px_0_var(--color-primary-shade)]',
                        !done &&
                            !stage.locked &&
                            'border-primary text-primary border-4 bg-white shadow-[0_5px_0_var(--color-primary-shade)]',
                        stage.locked &&
                            'border-paper-edge bg-secondary text-muted-foreground border-2 shadow-[0_5px_0_var(--color-paper-edge)]',
                    )}
                    style={{ left: `${lane}%` }}
                >
                    {done ? (
                        <CheckIcon
                            className="size-10 sm:size-14"
                            strokeWidth={2.6}
                        />
                    ) : stage.locked ? (
                        <LockIcon className="size-8 sm:size-11" />
                    ) : (
                        <span aria-hidden="true">{number}</span>
                    )}
                </summary>
                <span
                    aria-hidden="true"
                    className="border-paper-edge absolute top-[7.25rem] z-30 size-4 -translate-x-1/2 rotate-45 border-t-2 border-l-2 bg-white sm:top-[9.25rem]"
                    style={{ left: `${lane}%` }}
                />
                <div
                    ref={panel}
                    className="border-paper-edge absolute top-[7.75rem] z-20 w-max max-w-[calc(100vw-2rem)] min-w-48 -translate-x-1/2 scroll-mb-4 space-y-2 rounded-2xl border-2 bg-white p-4 text-center shadow-lg sm:top-[9.75rem]"
                    style={{ left: `calc(${lane}% + var(--shift, 0px))` }}
                >
                    <p className="text-muted-foreground text-base">
                        Misi {number}
                    </p>
                    <p className="font-display text-primary-deep text-xl leading-snug font-semibold break-words">
                        {stage.title}
                    </p>
                    <p
                        className={cn(
                            'text-base',
                            current
                                ? 'text-primary font-bold'
                                : 'text-muted-foreground',
                        )}
                    >
                        {status}
                    </p>
                    {stage.locked ? (
                        <p className="text-base leading-relaxed">
                            Selesaikan misi sebelumnya dulu, ya.
                        </p>
                    ) : (
                        <Link
                            to={`/student/sessions/${stage.id}`}
                            className={buttonVariants({
                                feel: 'chunky',
                                className: 'mt-1 w-full',
                            })}
                        >
                            {actionOf(stage)}
                        </Link>
                    )}
                </div>
            </details>
            {current && (
                <span
                    className="absolute top-7 sm:top-9"
                    style={{ left: `${lane}%` }}
                >
                    <span
                        className={cn(
                            'absolute top-0 w-14 sm:w-20',
                            lane > 50
                                ? 'right-12 sm:right-16'
                                : 'left-12 sm:left-16',
                        )}
                    >
                        <JalakBali className="w-full" />
                    </span>
                </span>
            )}
        </li>
    );
}

export function ChapterPath({ chapterId }: { chapterId: number }) {
    const query = useQuery(studentPathQuery());
    const classroom = useQuery(studentClassQuery());
    const list = useRef<HTMLOListElement>(null);
    useEffect(() => {
        function openMission() {
            return (
                list.current?.querySelector<HTMLDetailsElement>(
                    'details[open]',
                ) ?? null
            );
        }
        function closeOutside(event: PointerEvent) {
            const mission = openMission();
            if (
                mission &&
                event.target instanceof Element &&
                !mission.contains(event.target)
            )
                mission.open = false;
        }
        function closeOnEscape(event: KeyboardEvent) {
            const mission = openMission();
            if (event.key !== 'Escape' || !mission) return;
            mission.open = false;
            mission.querySelector('summary')?.focus();
        }
        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, []);
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
                        ref={list}
                        aria-label={`Misi di bab ${chapter.title}`}
                        className="relative mx-auto max-w-lg"
                    >
                        <Trail stages={stages} />
                        {stages.map((stage, index) => (
                            <Mission
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

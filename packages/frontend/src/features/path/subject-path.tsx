import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { StudentNavLink } from '../../components/student-nav-link';
import { CheckIcon } from '../../components/icons/check-icon';
import { LockIcon } from '../../components/icons/lock-icon';
import { JalakBali } from '../../components/jalak-bali';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import type { Subject } from '../assignments/queries';
import { SubjectArt, useSubject } from '../assignments/subject-art';
import { studentFollowUpsQuery } from '../follow-ups/queries';
import { studentExtraQuery, studentReviewQuery } from '../review/queries';
import { stepLabels } from '../learning-sessions/steps';
import {
    chaptersOf,
    currentStage,
    finished,
    studentPathQuery,
    visibleChapters,
    type Chapter,
    type Stage,
} from './queries';
import { StageBar } from './stage-bar';
import { TEACHER_TITLE } from '../student/teacher-title';

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

function Trail({ done }: { done: boolean[] }) {
    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%-13rem)] w-full"
            viewBox={`0 0 100 ${done.length * 100}`}
            preserveAspectRatio="none"
        >
            {done.slice(1).map((_, index) => {
                const x1 = lanes[index % lanes.length];
                const x2 = lanes[(index + 1) % lanes.length];
                const y1 = index * 100 + nodeY;
                const y2 = y1 + 100;
                return (
                    <path
                        key={index}
                        d={`M${x1} ${y1}C${x1} ${y1 + 55} ${x2} ${y2 - 55} ${x2} ${y2}`}
                        fill="none"
                        stroke={
                            done[index]
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

function useBubble() {
    const panel = useRef<HTMLDivElement>(null);
    const onToggle = (event: React.ToggleEvent<HTMLDetailsElement>) => {
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
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        element.scrollIntoView({
            block: 'nearest',
            behavior: still ? 'auto' : 'smooth',
        });
    };
    return { panel, onToggle };
}

const nodeBase =
    'font-display focus-visible:outline-ring absolute top-6 flex size-20 -translate-x-1/2 cursor-pointer list-none items-center justify-center rounded-full text-3xl font-semibold transition-[translate,box-shadow] duration-100 focus-visible:outline-3 focus-visible:outline-offset-4 active:translate-y-1 active:shadow-none sm:size-28 sm:text-4xl [&::-webkit-details-marker]:hidden';
const lockedNode =
    'border-paper-edge bg-secondary text-muted-foreground border-2 shadow-[0_5px_0_var(--color-paper-edge)]';
const bubbleArrow =
    'border-paper-edge absolute top-[7.25rem] z-30 size-4 -translate-x-1/2 rotate-45 border-t-2 border-l-2 bg-white sm:top-[9.25rem]';
const bubble =
    'border-paper-edge absolute top-[7.75rem] z-20 w-max max-w-[calc(100vw-2rem)] min-w-48 -translate-x-1/2 scroll-mb-4 space-y-2 rounded-2xl border-2 bg-white p-4 text-center shadow-lg sm:top-[9.75rem]';

function NextChapter({
    chapter,
    lane,
    teacher,
}: {
    chapter: Chapter;
    lane: number;
    teacher: string;
}) {
    const { panel, onToggle } = useBubble();
    return (
        <li
            id={`bab-${chapter.id}`}
            className="relative h-32 scroll-mt-4 sm:h-40"
        >
            <details name="mission-path" onToggle={onToggle}>
                <summary
                    aria-label={`Bab berikutnya: ${chapter.title}, terkunci`}
                    className={cn(nodeBase, lockedNode)}
                    style={{ left: `${lane}%` }}
                >
                    <LockIcon className="size-8 sm:size-11" />
                </summary>
                <span
                    aria-hidden="true"
                    className={bubbleArrow}
                    style={{ left: `${lane}%` }}
                />
                <div
                    ref={panel}
                    className={bubble}
                    style={{ left: `calc(${lane}% + var(--shift, 0px))` }}
                >
                    <p className="text-muted-foreground text-base">
                        Bab berikutnya
                    </p>
                    <p className="font-display text-primary-deep text-xl leading-snug font-semibold break-words">
                        {chapter.title}
                    </p>
                    <p className="max-w-64 text-base leading-relaxed">
                        Misinya muncul saat {teacher} membuka bab ini.
                    </p>
                </div>
            </details>
        </li>
    );
}

function Mission({
    stage,
    chapter,
    number,
    lane,
    current,
    anchor,
}: {
    stage: Stage;
    chapter: Chapter;
    number: number;
    lane: number;
    current: boolean;
    anchor: boolean;
}) {
    const done = stage.progress === 'submitted';
    const status = statusOf(stage);
    const { panel, onToggle } = useBubble();
    return (
        <li
            id={anchor ? `bab-${chapter.id}` : undefined}
            className="relative h-32 scroll-mt-4 sm:h-40"
        >
            <details name="mission-path" onToggle={onToggle}>
                <summary
                    aria-label={`${chapter.title}, misi ${number}: ${stage.title}, ${status}`}
                    className={cn(
                        nodeBase,
                        done &&
                            'bg-primary text-primary-foreground shadow-[0_5px_0_var(--color-primary-shade)]',
                        !done &&
                            !stage.locked &&
                            'border-primary text-primary border-4 bg-white shadow-[0_5px_0_var(--color-primary-shade)]',
                        stage.locked && lockedNode,
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
                    className={bubbleArrow}
                    style={{ left: `${lane}%` }}
                />
                <div
                    ref={panel}
                    className={bubble}
                    style={{ left: `calc(${lane}% + var(--shift, 0px))` }}
                >
                    <p className="text-muted-foreground text-base">
                        {chapter.title} · Misi {number}
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

export function SubjectPath({ subject }: { subject: Subject }) {
    const query = useQuery(studentPathQuery());
    const review = useQuery(studentReviewQuery(subject));
    const extra = useQuery(studentExtraQuery(subject)).data?.extra;
    const followUps =
        useQuery(studentFollowUpsQuery(subject)).data?.followUps ?? [];
    const path = useRef<HTMLDivElement>(null);
    const { label, tint } = useSubject(subject);
    useEffect(() => {
        function openMission() {
            return (
                path.current?.querySelector<HTMLDetailsElement>(
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
                Sebentar, kita siapkan jalur {label}…
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
                    Muat ulang jalur
                </Button>
            </div>
        );
    const chapters = chaptersOf(query.data, subject) ?? [];
    const opened = chapters.filter(({ open }) => open);
    const stages = opened.flatMap((chapter) => chapter.stages);
    const shown = visibleChapters(chapters);
    const next = shown.at(-1)?.open === false ? shown.at(-1) : undefined;
    const current = currentStage(opened)?.stage;
    const teacher = TEACHER_TITLE;
    const reviewCount = review.data?.questions.length ?? 0;
    const nodes = opened.flatMap((chapter) =>
        chapter.stages.map((stage, index) => ({ chapter, stage, index })),
    );
    const done = [
        ...nodes.map(({ stage }) => stage.progress === 'submitted'),
        ...(next ? [false] : []),
    ];
    return (
        <div className="space-y-6">
            <StudentNavLink back to="/student">
                Kembali ke beranda
            </StudentNavLink>
            <header
                className={cn(
                    'border-primary-deep/10 space-y-3 rounded-[24px] border-2 border-b-[6px] p-5 sm:p-7',
                    tint,
                )}
            >
                <div className="flex items-center gap-4 sm:gap-6">
                    <SubjectArt
                        subject={subject}
                        className="size-16 bg-white sm:size-20"
                    />
                    <div className="min-w-0 flex-1">
                        <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                            {label}
                        </h1>
                        {stages.length > 0 && (
                            <StageBar stages={stages} className="mt-1" />
                        )}
                    </div>
                </div>
                {stages.length > 0 && !current && (
                    <p className="text-lg leading-relaxed">
                        Semua misi yang dibuka sudah selesai. Tunggu bab
                        berikutnya dari {teacher}, ya.
                    </p>
                )}
            </header>
            {followUps.map((followUp) => (
                <Action
                    key={followUp.id}
                    id={`follow-up-${followUp.id}`}
                    title="Dari gurumu"
                    tone="bg-student-surface"
                    to={`/student/follow-ups/${followUp.id}`}
                    label="Mulai"
                >
                    {followUp.competency === null
                        ? `Tantangan tambahan dari misi ${followUp.mission}`
                        : `Latihan lagi: ${followUp.competency}`}
                    {followUp.note && (
                        <span className="block">
                            Pesan gurumu: {followUp.note}
                        </span>
                    )}
                </Action>
            ))}
            {reviewCount > 0 && (
                <Action
                    id="review"
                    title="Ulang Yuk"
                    tone="bg-student-accent-soft"
                    to={`/student/subjects/${subject}/review`}
                    label="Mulai Ulang Yuk"
                >
                    {reviewCount} soal singkat dari misi yang sudah kamu
                    kerjakan.
                </Action>
            )}
            {extra && (
                <Action
                    id="extra"
                    title="Tantangan tambahan"
                    to={`/student/subjects/${subject}/extra`}
                    label="Coba tantangannya"
                    outline={reviewCount > 0}
                >
                    Satu soal baru dari misi {extra.mission} untuk kamu coba.
                </Action>
            )}
            {stages.length === 0 ? (
                <p className="bg-student-accent-soft rounded-2xl p-4 text-lg leading-relaxed sm:p-5">
                    Belum ada bab {label} yang dibuka. Coba lihat mata pelajaran
                    lain di beranda.
                </p>
            ) : (
                <div ref={path}>
                    <ol
                        aria-label={`Jalur misi ${label}`}
                        className="relative mx-auto max-w-lg pb-52"
                    >
                        <Trail done={done} />
                        {nodes.map(({ chapter, stage, index }, position) => (
                            <Mission
                                key={stage.id}
                                stage={stage}
                                chapter={chapter}
                                number={position + 1}
                                lane={lanes[position % lanes.length]}
                                current={stage === current}
                                anchor={index === 0}
                            />
                        ))}
                        {next && (
                            <NextChapter
                                chapter={next}
                                lane={lanes[nodes.length % lanes.length]}
                                teacher={teacher}
                            />
                        )}
                    </ol>
                </div>
            )}
        </div>
    );
}

function Action({
    id,
    title,
    to,
    label,
    outline = false,
    tone = 'bg-white',
    children,
}: {
    id: string;
    title: string;
    to: string;
    label: string;
    outline?: boolean;
    tone?: string;
    children: ReactNode;
}) {
    return (
        <section
            aria-labelledby={`${id}-title`}
            className={cn(
                'border-paper-edge flex flex-col gap-3 rounded-2xl border-2 border-b-[5px] p-4 sm:flex-row sm:items-center sm:p-5',
                tone,
            )}
        >
            <div className="min-w-0 flex-1">
                <h2
                    id={`${id}-title`}
                    className="font-display text-primary-deep text-xl font-semibold"
                >
                    {title}
                </h2>
                <p
                    id={`${id}-what`}
                    className="text-lg leading-relaxed break-words"
                >
                    {children}
                </p>
            </div>
            <Link
                to={to}
                aria-describedby={`${id}-what`}
                className={buttonVariants({
                    feel: 'chunky',
                    variant: outline ? 'outline' : 'primary',
                })}
            >
                {label}
            </Link>
        </section>
    );
}

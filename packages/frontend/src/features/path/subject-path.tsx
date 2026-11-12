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
import type { Subject } from '../assignments/queries';
import { SubjectArt, subjects } from '../assignments/subject-art';
import { studentClassQuery } from '../classes/queries';
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
import { ChapterSticker } from './chapter-sticker';
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

function OpenChapter({
    subject,
    chapter,
    number,
    current,
}: {
    subject: Subject;
    chapter: Chapter;
    number: number;
    current: Stage | undefined;
}) {
    const { stages } = chapter;
    const done = finished(stages) === stages.length;
    return (
        <section
            id={`bab-${chapter.id}`}
            aria-labelledby={`bab-${chapter.id}-title`}
            className="scroll-mt-4 space-y-2"
        >
            <header className="border-paper-edge flex items-center gap-4 rounded-[24px] border-2 border-b-[6px] bg-white p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-base">
                        Bab {number}
                        {done && ' · Selesai, stikernya sudah kamu dapat'}
                    </p>
                    <h2
                        id={`bab-${chapter.id}-title`}
                        className="font-display text-primary-deep text-2xl leading-tight font-semibold break-words sm:text-3xl"
                    >
                        {chapter.title}
                    </h2>
                    <StageBar stages={stages} className="mt-2" />
                </div>
                {done && (
                    <ChapterSticker
                        subject={subject}
                        className="size-16 sm:size-20"
                    />
                )}
            </header>
            <ol
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
        </section>
    );
}

function LockedChapter({
    chapter,
    number,
    teacher,
}: {
    chapter: Chapter;
    number: number;
    teacher: string;
}) {
    return (
        <section
            id={`bab-${chapter.id}`}
            aria-labelledby={`bab-${chapter.id}-title`}
            className="border-paper-edge bg-student-surface flex scroll-mt-4 items-center gap-4 rounded-[24px] border-2 border-dashed p-4 sm:p-5"
        >
            <span className="bg-secondary text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-full">
                <LockIcon className="size-7" />
            </span>
            <span className="min-w-0">
                <span className="text-muted-foreground block text-base">
                    Bab {number} · Terkunci
                </span>
                <h2
                    id={`bab-${chapter.id}-title`}
                    className="font-display text-primary-deep text-xl leading-snug font-semibold break-words"
                >
                    {chapter.title}
                </h2>
                <span className="text-muted-foreground block text-base">
                    Misinya muncul saat {teacher} membuka bab ini.
                </span>
            </span>
        </section>
    );
}

export function SubjectPath({ subject }: { subject: Subject }) {
    const query = useQuery(studentPathQuery());
    const classroom = useQuery(studentClassQuery());
    const review = useQuery(studentReviewQuery(subject));
    const extra = useQuery(studentExtraQuery(subject)).data?.extra;
    const followUps =
        useQuery(studentFollowUpsQuery(subject)).data?.followUps ?? [];
    const path = useRef<HTMLDivElement>(null);
    const { label, tint } = subjects[subject];
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
    const stages = chapters.flatMap((chapter) => chapter.stages);
    const current = currentStage(chapters)?.stage;
    const teacher = classroom.data?.classroom?.teacherName ?? 'gurumu';
    const reviewCount = review.data?.questions.length ?? 0;
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
                    {stages.length > 0 && (
                        <p className="text-muted-foreground mt-1 text-lg">
                            {finished(stages)} dari {stages.length} misi selesai
                        </p>
                    )}
                </div>
            </header>
            {followUps.map((followUp) => (
                <section
                    key={followUp.id}
                    aria-labelledby={`follow-up-${followUp.id}-title`}
                    className="border-paper-edge bg-student-surface flex flex-col gap-3 rounded-2xl border-2 border-b-[5px] p-4 sm:flex-row sm:items-center sm:p-5"
                >
                    <div className="min-w-0 flex-1">
                        <h2
                            id={`follow-up-${followUp.id}-title`}
                            className="font-display text-primary-deep text-xl font-semibold"
                        >
                            Dari gurumu
                        </h2>
                        <p
                            id={`follow-up-${followUp.id}-what`}
                            className="text-lg leading-relaxed break-words"
                        >
                            {followUp.competency === null
                                ? `Tantangan tambahan dari misi ${followUp.mission}`
                                : `Latihan lagi: ${followUp.competency}`}
                        </p>
                        {followUp.note && (
                            <p className="text-lg leading-relaxed break-words">
                                Pesan gurumu: {followUp.note}
                            </p>
                        )}
                    </div>
                    <Link
                        to={`/student/follow-ups/${followUp.id}`}
                        aria-describedby={`follow-up-${followUp.id}-what`}
                        className={buttonVariants({ feel: 'chunky' })}
                    >
                        Mulai
                    </Link>
                </section>
            ))}
            {reviewCount > 0 && (
                <section
                    aria-labelledby="review-title"
                    className="border-paper-edge bg-student-accent-soft flex flex-col gap-3 rounded-2xl border-2 border-b-[5px] p-4 sm:flex-row sm:items-center sm:p-5"
                >
                    <div className="min-w-0 flex-1">
                        <h2
                            id="review-title"
                            className="font-display text-primary-deep text-xl font-semibold"
                        >
                            Ulang Yuk
                        </h2>
                        <p className="text-lg leading-relaxed">
                            {reviewCount} soal singkat dari misi yang sudah kamu
                            kerjakan.
                        </p>
                    </div>
                    <Link
                        to={`/student/subjects/${subject}/review`}
                        className={buttonVariants({ feel: 'chunky' })}
                    >
                        Mulai Ulang Yuk
                    </Link>
                </section>
            )}
            {extra && (
                <section
                    aria-labelledby="extra-title"
                    className="border-paper-edge flex flex-col gap-3 rounded-2xl border-2 border-b-[5px] bg-white p-4 sm:flex-row sm:items-center sm:p-5"
                >
                    <div className="min-w-0 flex-1">
                        <h2
                            id="extra-title"
                            className="font-display text-primary-deep text-xl font-semibold"
                        >
                            Tantangan tambahan
                        </h2>
                        <p className="text-lg leading-relaxed">
                            Satu soal baru dari misi {extra.mission} untuk kamu
                            coba.
                        </p>
                    </div>
                    <Link
                        to={`/student/subjects/${subject}/extra`}
                        className={buttonVariants({
                            feel: 'chunky',
                            variant: reviewCount > 0 ? 'outline' : 'primary',
                        })}
                    >
                        Coba tantangannya
                    </Link>
                </section>
            )}
            {stages.length === 0 ? (
                <p className="bg-student-accent-soft rounded-2xl p-4 text-lg leading-relaxed sm:p-5">
                    Belum ada bab {label} yang dibuka. Coba lihat mata pelajaran
                    lain di beranda.
                </p>
            ) : (
                <div ref={path} className="space-y-8">
                    {!current && (
                        <p className="bg-student-surface border-paper-edge rounded-2xl border-2 p-4 text-center text-lg leading-relaxed sm:p-5">
                            Semua misi yang dibuka sudah selesai. Tunggu bab
                            berikutnya dari {teacher}, ya.
                        </p>
                    )}
                    {visibleChapters(chapters).map((chapter, index) =>
                        chapter.open ? (
                            <OpenChapter
                                key={chapter.id}
                                subject={subject}
                                chapter={chapter}
                                number={index + 1}
                                current={current}
                            />
                        ) : (
                            <LockedChapter
                                key={chapter.id}
                                chapter={chapter}
                                number={index + 1}
                                teacher={teacher}
                            />
                        ),
                    )}
                </div>
            )}
        </div>
    );
}

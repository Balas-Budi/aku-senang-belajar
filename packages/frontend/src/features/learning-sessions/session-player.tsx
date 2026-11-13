import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { HelpIcon } from '../../components/icons/help-icon';
import { PauseIcon } from '../../components/icons/pause-icon';
import { Button, buttonVariants } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { cn } from '../../lib/cn';
import { useMinutesLeft } from '../../lib/use-minutes-left';
import { LearningSettingsForm } from '../settings/learning-settings';
import { TextScale } from '../settings/text-scale';
import { AdaptationContext, MissionReadAloudContext } from './adaptation';
import { ChallengeBlock } from './challenge-block';
import { CheckBlock } from './check-block';
import { HookBlock } from './hook-block';
import { MemoryGame } from './memory-game';
import {
    sessionQuery,
    studentLiveQuery,
    useHelp,
    useMoveCheckpoint,
    type Attempt,
    type Block,
    type LearningSession,
    type LiveSession,
} from './queries';
import { ReflectionBlock } from './reflection-block';
import { SessionDone, SessionIntro, SessionPreparing } from './session-screens';
import { useActionError, WaitContext } from './session-ui';
import { stepLabels, stepOrder } from './steps';
import { StoryBlock } from './story-block';
import { TEACHER_TITLE } from '../student/teacher-title';

const tool =
    'text-primary-deep min-h-12 rounded-xl border-2 px-3 font-semibold';

type BlockScreen = {
    session: LearningSession;
    attempt: Attempt;
    block: Block;
    teacher: string;
};

function Screen({
    session,
    attempt,
    block,
    teacher,
    onNext,
}: BlockScreen & { onNext: () => void }) {
    const shared = { assignmentId: session.id, attempt, teacher, onNext };

    switch (block.kind) {
        case 'brain_game':
            return <MemoryGame seed={attempt.id} onDone={onNext} />;
        case 'hook':
            return <HookBlock {...shared} block={block} />;
        case 'story': {
            const stories = session.blocks.filter(
                (candidate) => candidate.kind === 'story',
            );
            return (
                <StoryBlock
                    block={block}
                    number={stories.indexOf(block) + 1}
                    total={stories.length}
                    onNext={onNext}
                />
            );
        }
        case 'check':
            return <CheckBlock {...shared} block={block} />;
        case 'challenge':
            return <ChallengeBlock {...shared} block={block} />;
        case 'reflection':
            return <ReflectionBlock {...shared} block={block} />;
    }
}

function CurrentBlock({
    live,
    ...screen
}: BlockScreen & { live: LiveSession | null }) {
    const { session, attempt, block } = screen;
    const move = useMoveCheckpoint(session.id);
    const next = session.blocks.find(
        (candidate) => candidate.position > block.position,
    );
    const waiting =
        live?.state === 'open' &&
        live.mode === 'together' &&
        next !== undefined &&
        stepOrder.indexOf(next.step) > stepOrder.indexOf(live.openStep);
    const onNext = () => {
        if (next && !waiting)
            move.mutate({ attemptId: attempt.id, blockId: next.id });
    };

    return (
        <WaitContext value={waiting}>
            <Screen {...screen} onNext={onNext} />
        </WaitContext>
    );
}

function TimeLeft({ endsAt }: { endsAt: string }) {
    const minutes = useMinutesLeft(endsAt);

    return (
        minutes !== null && (
            <p className="text-primary-deep font-semibold tabular-nums">
                Sisa {minutes} menit
            </p>
        )
    );
}

export function SessionPlayer({ assignmentId }: { assignmentId: number }) {
    const { data: session } = useSuspenseQuery(sessionQuery(assignmentId));
    const { attempt } = session;
    const { data: watched } = useQuery({
        ...studentLiveQuery(assignmentId),
        enabled: attempt?.status === 'in_progress',
    });
    const teacher = TEACHER_TITLE;
    const [adjusting, setAdjusting] = useState(false);
    const [pausing, setPausing] = useState(false);
    const [helping, setHelping] = useState(false);
    const [askedAt, setAskedAt] = useState<number | null>(null);
    const [timeUpAt, setTimeUpAt] = useState<number | null>(null);
    const ran = useRef(false);
    const help = useHelp(assignmentId);
    const showError = useActionError();
    const chapterLink = `/student/chapters/${session.moduleId}`;
    const block =
        attempt?.status === 'in_progress'
            ? (session.blocks.find((item) => item.id === attempt.checkpoint) ??
              session.blocks.at(0))
            : undefined;
    const step = block ? stepOrder.indexOf(block.step) : -1;
    const blockId = block?.id;
    const live = block ? (watched?.live ?? null) : null;
    const paused = live?.state === 'paused';

    useEffect(() => {
        if (!live || blockId === undefined) return;
        if (live.state !== 'ended') {
            ran.current = true;
            return;
        }
        // shortcut: the device clock, a minute of slack, guesses a time-out; use the API's end reason once it sends one
        if (
            ran.current &&
            live.endsAt &&
            Date.parse(live.endsAt) - Date.now() < 60_000
        )
            setTimeUpAt(blockId);
        ran.current = false;
    }, [live, blockId]);

    function askTeacher() {
        if (!attempt || blockId === undefined) return;
        help.mutate(
            { attemptId: attempt.id, blockId, kind: 'ask_teacher' },
            { onSuccess: () => setAskedAt(blockId), onError: showError },
        );
    }

    return (
        <AdaptationContext value={attempt?.adaptation ?? null}>
            <MissionReadAloudContext value={session.readAloud}>
                <div className="bg-student-surface font-rounded min-h-svh text-lg">
                    <TextScale />
                    <header className="border-paper-edge border-b-2 bg-white">
                        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-2">
                            {block ? (
                                <Button
                                    variant="outline"
                                    className={tool}
                                    onClick={() => setPausing(true)}
                                >
                                    <PauseIcon />
                                    Rehat
                                </Button>
                            ) : (
                                <Link
                                    to={chapterLink}
                                    className={cn(
                                        buttonVariants({ variant: 'outline' }),
                                        tool,
                                    )}
                                >
                                    Kembali ke bab
                                </Link>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    aria-label="Pengaturan belajar"
                                    className={cn(
                                        tool,
                                        'font-display min-w-12',
                                    )}
                                    onClick={() => setAdjusting(true)}
                                >
                                    Aa
                                </Button>
                                {block && (
                                    <Button
                                        variant="outline"
                                        className={tool}
                                        onClick={() => setHelping(true)}
                                    >
                                        <HelpIcon />
                                        Bantuan
                                    </Button>
                                )}
                            </div>
                        </div>
                        {block && (
                            <div className="mx-auto max-w-2xl px-4 pb-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                                    <p className="font-display text-primary-deep font-semibold">
                                        Langkah {step + 1} dari{' '}
                                        {stepOrder.length} ·{' '}
                                        {stepLabels[block.step]}
                                    </p>
                                    {live?.state === 'open' && live.endsAt && (
                                        <TimeLeft endsAt={live.endsAt} />
                                    )}
                                </div>
                                <div
                                    aria-hidden="true"
                                    className="mt-2 grid grid-cols-4 gap-1.5"
                                >
                                    {stepOrder.map((item, index) => (
                                        <span
                                            key={item}
                                            className={cn(
                                                'h-2 rounded-full',
                                                index <= step
                                                    ? 'bg-primary'
                                                    : 'bg-secondary',
                                            )}
                                        />
                                    ))}
                                </div>
                                <div role="status">
                                    {timeUpAt === block.id && (
                                        <p className="bg-student-accent-soft text-student-accent-ink mt-3 rounded-xl px-3 py-2 font-semibold">
                                            Waktu sesi habis. Kamu masih bisa
                                            melanjutkan.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </header>
                    <main
                        id="main"
                        className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8"
                    >
                        {session.blocks.length === 0 ? (
                            <SessionPreparing />
                        ) : !attempt ? (
                            <SessionIntro session={session} teacher={teacher} />
                        ) : !block ? (
                            <SessionDone
                                session={session}
                                done={
                                    attempt.done ?? {
                                        takeaways: [],
                                        toPractise: [],
                                    }
                                }
                                teacher={teacher}
                            />
                        ) : (
                            <CurrentBlock
                                key={block.id}
                                session={session}
                                attempt={attempt}
                                block={block}
                                teacher={teacher}
                                live={live}
                            />
                        )}
                    </main>
                    <Dialog
                        open={pausing}
                        onClose={() => setPausing(false)}
                        aria-labelledby="pause-title"
                        className="font-rounded"
                    >
                        <h2
                            id="pause-title"
                            className="font-display text-primary-deep text-[1.4em] font-semibold"
                        >
                            Istirahat dulu?
                        </h2>
                        <p className="mt-2 leading-relaxed">
                            Jawaban yang sudah terkirim aman. Nanti kamu lanjut
                            dari langkah ini.
                        </p>
                        <div className="mt-5 flex flex-col gap-3">
                            <Button
                                feel="chunky"
                                autoFocus
                                onClick={() => setPausing(false)}
                            >
                                Lanjut belajar
                            </Button>
                            <Link
                                to={chapterLink}
                                className={buttonVariants({
                                    variant: 'outline',
                                    feel: 'chunky',
                                })}
                            >
                                Kembali ke bab
                            </Link>
                        </div>
                    </Dialog>
                    <Dialog
                        open={helping}
                        onClose={() => setHelping(false)}
                        aria-labelledby="help-title"
                        className="font-rounded"
                    >
                        <h2
                            id="help-title"
                            className="font-display text-primary-deep text-[1.4em] font-semibold"
                        >
                            Butuh bantuan?
                        </h2>
                        <p className="mt-2 leading-relaxed">
                            Kamu bisa minta bantuan {teacher}. Permintaanmu
                            dicatat, lalu kamu tetap bisa lanjut belajar.
                        </p>
                        {askedAt === block?.id && (
                            <p
                                role="status"
                                className="text-primary-deep mt-3 font-semibold"
                            >
                                Permintaanmu sudah dicatat untuk {teacher}.
                            </p>
                        )}
                        <div className="mt-5 flex flex-col gap-3">
                            {askedAt !== block?.id && (
                                <Button
                                    feel="chunky"
                                    disabled={help.isPending}
                                    onClick={askTeacher}
                                >
                                    Tanya {teacher}
                                </Button>
                            )}
                            <Button
                                feel="chunky"
                                variant="outline"
                                onClick={() => setHelping(false)}
                            >
                                {askedAt === block?.id
                                    ? 'Kembali belajar'
                                    : 'Tutup'}
                            </Button>
                        </div>
                    </Dialog>
                    <Dialog
                        open={adjusting}
                        onClose={() => setAdjusting(false)}
                        aria-labelledby="settings-title"
                        className="font-rounded max-h-[calc(100svh-2rem)] max-w-lg overflow-y-auto"
                    >
                        <h2
                            id="settings-title"
                            className="font-display text-primary-deep mb-5 text-[1.4em] font-semibold"
                        >
                            Pengaturan belajar
                        </h2>
                        <LearningSettingsForm />
                        <Button
                            feel="chunky"
                            className="mt-6 w-full"
                            onClick={() => setAdjusting(false)}
                        >
                            Selesai
                        </Button>
                    </Dialog>
                    <Dialog
                        open={paused}
                        onClose={(dialog) => {
                            if (paused && !dialog.open) dialog.showModal();
                        }}
                        onCancel={(event) => event.preventDefault()}
                        aria-labelledby="live-paused-title"
                        aria-describedby="live-paused-note"
                        className="font-rounded text-center"
                    >
                        <PauseIcon className="text-primary mx-auto size-10" />
                        <h2
                            id="live-paused-title"
                            className="font-display text-primary-deep mt-3 text-[1.4em] font-semibold"
                        >
                            Gurumu menjeda misi sebentar.
                        </h2>
                        <p
                            id="live-paused-note"
                            className="mt-2 leading-relaxed"
                        >
                            Tunggu, ya. Jawabanmu aman.
                        </p>
                    </Dialog>
                </div>
            </MissionReadAloudContext>
        </AdaptationContext>
    );
}

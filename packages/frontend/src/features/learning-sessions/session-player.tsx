import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { HelpIcon } from '../../components/icons/help-icon';
import { PauseIcon } from '../../components/icons/pause-icon';
import { requestErrorMessage } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { useErrorToast } from '../../components/ui/toast';
import { cn } from '../../lib/cn';
import { studentClassQuery } from '../classes/queries';
import { LearningSettingsForm } from '../settings/learning-settings';
import { TextScale } from '../settings/text-scale';
import { ChallengeBlock } from './challenge-block';
import { CheckBlock } from './check-block';
import { HookBlock } from './hook-block';
import { MemoryGame } from './memory-game';
import {
    sessionQuery,
    useHelp,
    useMoveCheckpoint,
    type Attempt,
    type Block,
    type LearningSession,
} from './queries';
import { ReflectionBlock } from './reflection-block';
import { SessionDone, SessionIntro, SessionPreparing } from './session-screens';
import { stepLabels, stepOrder } from './steps';
import { StoryBlock } from './story-block';

const tool =
    'text-primary-deep min-h-12 rounded-xl border-2 px-3 font-semibold';

function CurrentBlock({
    session,
    attempt,
    block,
    teacher,
}: {
    session: LearningSession;
    attempt: Attempt;
    block: Block;
    teacher: string;
}) {
    const move = useMoveCheckpoint(session.id);
    const next = session.blocks.find(
        (candidate) => candidate.position > block.position,
    );
    const onNext = () => {
        if (next) move.mutate({ attemptId: attempt.id, blockId: next.id });
    };
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

export function SessionPlayer({ assignmentId }: { assignmentId: number }) {
    const { data: session } = useSuspenseQuery(sessionQuery(assignmentId));
    const { data: mine } = useSuspenseQuery(studentClassQuery());
    const teacher = mine.classroom?.teacherName ?? 'gurumu';
    const [adjusting, setAdjusting] = useState(false);
    const [pausing, setPausing] = useState(false);
    const [helping, setHelping] = useState(false);
    const [askedAt, setAskedAt] = useState<number | null>(null);
    const help = useHelp(assignmentId);
    const showError = useErrorToast();
    const { attempt } = session;
    const chapterLink = `/student/chapters/${session.moduleId}`;
    const block =
        attempt?.status === 'in_progress'
            ? (session.blocks.find((item) => item.id === attempt.checkpoint) ??
              session.blocks.at(0))
            : undefined;
    const step = block ? stepOrder.indexOf(block.step) : -1;

    function askTeacher() {
        if (!attempt || !block) return;
        const blockId = block.id;
        help.mutate(
            { attemptId: attempt.id, blockId, kind: 'ask_teacher' },
            {
                onSuccess: () => setAskedAt(blockId),
                onError: (error) => showError(requestErrorMessage(error)),
            },
        );
    }

    return (
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
                            className={cn(tool, 'font-display min-w-12')}
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
                        <p className="font-display text-primary-deep font-semibold">
                            Langkah {step + 1} dari {stepOrder.length} ·{' '}
                            {stepLabels[block.step]}
                        </p>
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
                        done={attempt.done ?? { takeaways: [], toPractise: [] }}
                        teacher={teacher}
                    />
                ) : (
                    <CurrentBlock
                        key={block.id}
                        session={session}
                        attempt={attempt}
                        block={block}
                        teacher={teacher}
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
                    Jawaban yang sudah terkirim aman. Nanti kamu lanjut dari
                    langkah ini.
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
                    Kamu bisa minta bantuan {teacher}. Permintaanmu dicatat,
                    lalu kamu tetap bisa lanjut belajar.
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
                        {askedAt === block?.id ? 'Kembali belajar' : 'Tutup'}
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
        </div>
    );
}

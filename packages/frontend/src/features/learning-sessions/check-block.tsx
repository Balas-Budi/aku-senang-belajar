import { useState } from 'react';
import { requestErrorMessage } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { useErrorToast } from '../../components/ui/toast';
import { cn } from '../../lib/cn';
import { Illustration } from './illustration';
import { answersFor, useHelp, type Earned, type Picture } from './queries';
import {
    OfflineNote,
    OptionPicker,
    ReactingJalak,
    ReasonField,
    ScreenCard,
    ScreenHeading,
    type BlockProps,
} from './session-ui';
import { useAnswerSender } from './use-answer-sender';

const HINTS = 3;

function HelpCard({ title, picture }: { title: string; picture: Picture }) {
    return (
        <div className="bg-student-accent-soft flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            {picture.illustration && (
                <Illustration
                    name={picture.illustration}
                    className="w-full max-w-40 shrink-0"
                />
            )}
            <div>
                <p className="text-student-accent-ink font-bold">{title}</p>
                <p className="mt-1 leading-relaxed">{picture.text}</p>
            </div>
        </div>
    );
}

function Feedback({
    earned,
    cheers,
    chirps,
}: {
    earned: Earned;
    cheers: number;
    chirps: number;
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-2xl p-4',
                earned.praise ? 'bg-activity-green/15' : 'bg-student-surface',
            )}
        >
            <ReactingJalak cheers={cheers} chirps={chirps} />
            <div className="space-y-1">
                <p
                    role="status"
                    className="font-display text-primary-deep text-[1.2em] leading-snug font-semibold"
                >
                    {earned.praise ??
                        (earned.reveal
                            ? 'Tidak apa-apa. Ini jawabannya.'
                            : 'Hampir! Yuk, lihat lagi.')}
                </p>
                {earned.reveal && (
                    <p className="leading-relaxed">{earned.reveal.text}</p>
                )}
            </div>
        </div>
    );
}

export function CheckBlock({
    assignmentId,
    attempt,
    block,
    teacher,
    onNext,
}: BlockProps<'check'>) {
    const tries = answersFor(attempt, block.id);
    const last = tries.at(-1)?.answer;
    const [choice, setChoice] = useState(
        last?.kind === 'check' ? last.choice : null,
    );
    const [reason, setReason] = useState(
        last?.kind === 'check' ? (last.reason ?? '') : '',
    );
    const [asked, setAsked] = useState(false);
    const [reactions, setReactions] = useState({ cheers: 0, chirps: 0 });
    const sender = useAnswerSender(assignmentId);
    const help = useHelp(assignmentId);
    const showError = useErrorToast();
    const { content, earned } = block;
    const closed = earned.praise !== null || earned.reveal !== null;
    const reasonMissing = Boolean(content.reason) && !reason.trim();

    function check() {
        if (!choice || reasonMissing) return;
        sender.send(
            {
                attemptId: attempt.id,
                blockId: block.id,
                tryNumber: tries.length + 1,
                answer: {
                    kind: 'check',
                    choice,
                    ...(content.reason ? { reason: reason.trim() } : {}),
                },
            },
            ({ outcome }) =>
                setReactions((current) =>
                    outcome === 'correct'
                        ? { ...current, cheers: current.cheers + 1 }
                        : { ...current, chirps: current.chirps + 1 },
                ),
        );
    }

    function ask(kind: 'hint' | 'example' | 'ask_teacher') {
        help.mutate(
            { attemptId: attempt.id, blockId: block.id, kind },
            {
                onSuccess: () => {
                    if (kind === 'ask_teacher') setAsked(true);
                },
                onError: (error) => showError(requestErrorMessage(error)),
            },
        );
    }

    return (
        <ScreenCard aria-labelledby={`block-${block.id}`}>
            <ScreenHeading
                id={`block-${block.id}`}
                className="text-primary text-[1.1em]"
            >
                Cek sebentar!
            </ScreenHeading>
            {content.illustration && (
                <Illustration
                    name={content.illustration}
                    className="mx-auto max-w-sm"
                />
            )}
            <p className="font-display text-primary-deep text-[1.35em] leading-snug font-medium text-pretty">
                {content.prompt}
            </p>
            <OptionPicker
                name={`check-${block.id}`}
                legend={content.prompt}
                options={content.options}
                value={choice}
                onChange={setChoice}
                disabled={closed}
                correct={
                    earned.reveal?.answer ?? (earned.praise ? choice : null)
                }
            />
            {content.reason && !closed && (
                <ReasonField
                    id={`reason-${block.id}`}
                    label={content.reason.prompt}
                    starters={content.reason.starters}
                    value={reason}
                    onChange={setReason}
                />
            )}
            {(tries.length > 0 || closed) && (
                <Feedback earned={earned} {...reactions} />
            )}
            {earned.hints.map((hint, index) => (
                <HelpCard
                    key={hint.text}
                    title={`Petunjuk ${index + 1} dari ${HINTS}`}
                    picture={hint}
                />
            ))}
            {earned.example && (
                <HelpCard title="Contoh lain" picture={earned.example} />
            )}
            {!closed && (
                <div className="flex flex-wrap gap-2">
                    {earned.hints.length < HINTS && (
                        <Button
                            variant="outline"
                            disabled={help.isPending}
                            onClick={() => ask('hint')}
                        >
                            {earned.hints.length
                                ? 'Petunjuk lagi'
                                : 'Minta petunjuk'}
                        </Button>
                    )}
                    {!earned.example && (
                        <Button
                            variant="outline"
                            disabled={help.isPending}
                            onClick={() => ask('example')}
                        >
                            Contoh lain
                        </Button>
                    )}
                    {!asked && (
                        <Button
                            variant="outline"
                            disabled={help.isPending}
                            onClick={() => ask('ask_teacher')}
                        >
                            Tanya {teacher}
                        </Button>
                    )}
                </div>
            )}
            {asked && !closed && (
                <p role="status" className="text-primary-deep font-semibold">
                    Permintaanmu sudah dicatat untuk {teacher}. Kamu boleh coba
                    lagi atau lanjut dulu.
                </p>
            )}
            {sender.offline && <OfflineNote onRetry={sender.retry} />}
            {closed ? (
                <Button
                    feel="chunky"
                    className="w-full sm:w-auto"
                    autoFocus
                    onClick={onNext}
                >
                    Lanjut
                </Button>
            ) : (
                <div className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                            feel="chunky"
                            disabled={
                                !choice || reasonMissing || sender.sending
                            }
                            onClick={check}
                        >
                            {tries.length ? 'Periksa lagi' : 'Periksa'}
                        </Button>
                        {asked && (
                            <Button
                                feel="chunky"
                                variant="outline"
                                onClick={onNext}
                            >
                                Lanjut dulu
                            </Button>
                        )}
                    </div>
                    {(!choice || reasonMissing) && (
                        <p className="text-muted-foreground">
                            {!choice
                                ? 'Pilih satu jawaban dulu.'
                                : 'Tulis alasanmu dulu, ya.'}
                        </p>
                    )}
                </div>
            )}
        </ScreenCard>
    );
}

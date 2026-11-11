import { useContext, useId, useState } from 'react';
import { requestErrorMessage } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { useErrorToast } from '../../components/ui/toast';
import { cn } from '../../lib/cn';
import {
    NarrationControls,
    optionBeingRead,
    Spoken,
    useNarration,
} from '../narration/narration';
import {
    answerLabels,
    answerMissing,
    CheckAnswer,
    inPlaceNote,
} from './activity-input';
import { AdaptationContext, useLead } from './adaptation';
import { DiagramPicture } from './diagram';
import { Illustration } from './illustration';
import { answersFor, useHelp, type Earned, type Picture } from './queries';
import { ScreenPicture } from './screen-picture';
import {
    OfflineNote,
    ReactingJalak,
    ReasonField,
    ScreenCard,
    ScreenHeading,
    type BlockProps,
} from './session-ui';
import { useAnswerSender } from './use-answer-sender';

const HINTS = 3;

export function HelpCard({
    title,
    picture,
    onListen,
}: {
    title: string;
    picture: Picture;
    onListen?: () => void;
}) {
    const narration = useNarration(useId(), [picture.text]);
    const lead = useLead();
    const pictures = (
        <>
            {picture.illustration && (
                <Illustration
                    name={picture.illustration}
                    className="w-full max-w-40 shrink-0"
                />
            )}
            {picture.diagram && (
                <DiagramPicture
                    diagram={picture.diagram}
                    className="w-full max-w-48 shrink-0"
                />
            )}
        </>
    );
    return (
        <div className="bg-student-accent-soft flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            {lead !== 'text' && pictures}
            <div className="space-y-2">
                <p className="text-student-accent-ink font-bold">{title}</p>
                <p className="leading-relaxed">
                    <Spoken
                        text={picture.text}
                        sentence={narration.sentenceIn(0)}
                    />
                </p>
                <NarrationControls
                    narration={narration}
                    onListen={onListen}
                    quiet
                />
            </div>
            {lead === 'text' && pictures}
        </div>
    );
}

export function Feedback({
    earned,
    cheers,
    chirps,
    note,
}: {
    earned: Earned;
    cheers: number;
    chirps: number;
    note?: string;
}) {
    const message =
        earned.praise ??
        (earned.reveal
            ? 'Tidak apa-apa. Ini jawabannya.'
            : 'Hampir! Yuk, lihat lagi.');
    const narration = useNarration(useId(), [
        message,
        earned.reveal?.text ?? '',
    ]);
    return (
        <div
            className={cn(
                'space-y-3 rounded-2xl p-4',
                earned.praise ? 'bg-activity-green/15' : 'bg-student-surface',
            )}
        >
            <div className="flex items-center gap-3">
                <ReactingJalak cheers={cheers} chirps={chirps} />
                <div className="min-w-0 space-y-1">
                    <p
                        role="status"
                        className="font-display text-primary-deep text-[1.2em] leading-snug font-semibold"
                    >
                        {message}
                        {note && (
                            <>
                                {' '}
                                <span className="font-rounded block text-[0.85em] font-bold">
                                    {note}
                                </span>
                            </>
                        )}
                    </p>
                    {earned.reveal && (
                        <p className="leading-relaxed">
                            <Spoken
                                text={earned.reveal.text}
                                sentence={narration.sentenceIn(1)}
                            />
                        </p>
                    )}
                </div>
            </div>
            <NarrationControls narration={narration} quiet />
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
    const listen = useHelp(assignmentId);
    const adaptation = useContext(AdaptationContext);
    const [heard, setHeard] = useState<number | null>(null);
    const [inPlace, setInPlace] = useState<number | null>(null);
    const narration = useNarration(
        `block-${block.id}`,
        [content.prompt, ...answerLabels(content)],
        true,
    );

    function listenOnce() {
        if (closed || heard === tries.length) return;
        setHeard(tries.length);
        listen.mutate({
            attemptId: attempt.id,
            blockId: block.id,
            kind: 'listen',
        });
    }

    function check() {
        if (!choice || reasonMissing || sender.sending) return;
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
            (feedback) => {
                setInPlace(feedback.inPlace);
                setReactions((current) =>
                    feedback.outcome === 'correct'
                        ? { ...current, cheers: current.cheers + 1 }
                        : { ...current, chirps: current.chirps + 1 },
                );
            },
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

    const picture = (
        <ScreenPicture
            illustration={content.illustration}
            diagram={content.diagram}
            className="mx-auto max-w-sm"
        />
    );
    const exampleFirst = adaptation?.helpFirst === 'example';
    const exampleCard = earned.example && (
        <HelpCard
            title="Contoh lain"
            picture={earned.example}
            onListen={listenOnce}
        />
    );
    const exampleButton = !earned.example && (
        <Button
            variant="outline"
            disabled={help.isPending}
            onClick={() => ask('example')}
        >
            Contoh lain
        </Button>
    );

    return (
        <ScreenCard aria-labelledby={`block-${block.id}`}>
            <ScreenHeading
                id={`block-${block.id}`}
                className="text-primary text-[1.1em]"
            >
                Cek sebentar!
            </ScreenHeading>
            <NarrationControls narration={narration} onListen={listenOnce} />
            {adaptation?.lead !== 'text' && picture}
            <p className="font-display text-primary-deep text-[1.35em] leading-snug font-medium text-pretty">
                <Spoken
                    text={content.prompt}
                    sentence={narration.sentenceIn(0)}
                />
            </p>
            {adaptation?.lead === 'text' && picture}
            <CheckAnswer
                name={`check-${block.id}`}
                content={content}
                earned={earned}
                choice={choice}
                onChange={setChoice}
                reading={optionBeingRead(narration, content.options ?? [], 1)}
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
                <Feedback
                    earned={earned}
                    {...reactions}
                    note={closed ? undefined : inPlaceNote(content, inPlace)}
                />
            )}
            {exampleFirst && exampleCard}
            {earned.hints.map((hint, index) => (
                <HelpCard
                    key={hint.text}
                    title={`Petunjuk ${index + 1} dari ${HINTS}`}
                    picture={hint}
                    onListen={listenOnce}
                />
            ))}
            {!exampleFirst && exampleCard}
            {!closed && (
                <div className="flex flex-wrap gap-2">
                    {exampleFirst && exampleButton}
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
                    {!exampleFirst && exampleButton}
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
                            disabled={!choice || reasonMissing}
                            aria-disabled={sender.sending}
                            className="aria-disabled:opacity-60"
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
                                ? answerMissing(content)
                                : 'Tulis alasanmu dulu, ya.'}
                        </p>
                    )}
                </div>
            )}
        </ScreenCard>
    );
}

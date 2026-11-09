import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
    NarrationControls,
    optionBeingRead,
    Spoken,
    useNarration,
} from '../narration/narration';
import { readStored, store } from './device-storage';
import { Illustration } from './illustration';
import { answersFor, useHelp } from './queries';
import {
    OfflineNote,
    OptionPicker,
    ReasonField,
    ScreenCard,
    ScreenHeading,
    type BlockProps,
} from './session-ui';
import { useAnswerSender } from './use-answer-sender';

export function ChallengeBlock({
    assignmentId,
    attempt,
    block,
    teacher,
    onNext,
}: BlockProps<'challenge'>) {
    const saved = answersFor(attempt, block.id).at(0)?.answer;
    const sent = saved?.kind === 'challenge' ? saved : null;
    const draftKey = `aku-senang-belajar:draft:${attempt.id}:${block.id}`;
    const [choice, setChoice] = useState(sent?.choice ?? null);
    const [reason, setReason] = useState(sent?.reason ?? '');
    const sender = useAnswerSender(assignmentId);
    const { content } = block;
    const ready = choice !== null && reason.trim().length > 0;
    const listen = useHelp(assignmentId);
    const [heard, setHeard] = useState(false);
    const narration = useNarration(
        `block-${block.id}`,
        [
            content.prompt,
            content.question,
            ...content.options.map(({ label }) => label),
        ],
        true,
    );

    function listenOnce() {
        if (sent || heard) return;
        setHeard(true);
        listen.mutate({
            attemptId: attempt.id,
            blockId: block.id,
            kind: 'listen',
        });
    }

    useEffect(() => {
        if (sent) return;
        const draft = readStored(draftKey);
        if (draft) setReason(draft);
    }, [draftKey, sent]);

    function type(value: string) {
        setReason(value);
        store(draftKey, value || null);
    }

    function send() {
        if (!choice || !ready) return;
        sender.send(
            {
                attemptId: attempt.id,
                blockId: block.id,
                tryNumber: 1,
                answer: { kind: 'challenge', choice, reason: reason.trim() },
            },
            () => store(draftKey, null),
        );
    }

    return (
        <ScreenCard aria-labelledby={`block-${block.id}`}>
            <ScreenHeading
                id={`block-${block.id}`}
                className="text-primary text-[1.1em]"
            >
                Tantangan
            </ScreenHeading>
            <NarrationControls narration={narration} onListen={listenOnce} />
            <p className="leading-relaxed text-pretty">
                <Spoken
                    text={content.prompt}
                    sentence={narration.sentenceIn(0)}
                />
            </p>
            {content.illustration && (
                <Illustration
                    name={content.illustration}
                    className="mx-auto max-w-sm"
                />
            )}
            <p className="font-display text-primary-deep text-[1.35em] leading-snug font-medium text-pretty">
                <Spoken
                    text={content.question}
                    sentence={narration.sentenceIn(1)}
                />
            </p>
            <OptionPicker
                name={`challenge-${block.id}`}
                legend={content.question}
                options={content.options}
                value={choice}
                onChange={setChoice}
                disabled={Boolean(sent)}
                reading={optionBeingRead(narration, content.options, 2)}
            />
            <ReasonField
                id={`reason-${block.id}`}
                label="Alasanmu"
                placeholder={content.reasonStarter}
                value={reason}
                onChange={type}
                disabled={Boolean(sent)}
            />
            {sender.offline && <OfflineNote onRetry={sender.retry} />}
            {sent ? (
                <>
                    <p
                        role="status"
                        className="bg-student-surface text-primary-deep rounded-2xl px-4 py-3 font-semibold"
                    >
                        Jawabanmu sudah tersimpan untuk {teacher}.
                    </p>
                    <Button
                        feel="chunky"
                        className="w-full sm:w-auto"
                        autoFocus
                        onClick={onNext}
                    >
                        Lanjut
                    </Button>
                </>
            ) : (
                <div className="space-y-2">
                    <Button
                        feel="chunky"
                        className="w-full sm:w-auto"
                        disabled={!ready || sender.sending}
                        onClick={send}
                    >
                        Kirim jawaban
                    </Button>
                    {!ready && (
                        <p className="text-muted-foreground">
                            {choice === null
                                ? 'Pilih satu jawaban dulu.'
                                : 'Tulis alasanmu dulu, ya.'}
                        </p>
                    )}
                </div>
            )}
        </ScreenCard>
    );
}

import { useState } from 'react';
import { Button } from '../../components/ui/button';
import {
    NarrationControls,
    optionBeingRead,
    Spoken,
    useNarration,
} from '../narration/narration';
import { DiagramPicture } from './diagram';
import { Illustration } from './illustration';
import { answersFor } from './queries';
import {
    NextButton,
    OfflineNote,
    OptionPicker,
    ScreenCard,
    ScreenHeading,
    type BlockProps,
} from './session-ui';
import { useAnswerSender } from './use-answer-sender';

export function HookBlock({
    assignmentId,
    attempt,
    block,
    onNext,
}: BlockProps<'hook'>) {
    const saved = answersFor(attempt, block.id).at(0);
    const [choice, setChoice] = useState(
        saved?.answer.kind === 'hook' ? saved.answer.choice : null,
    );
    const sender = useAnswerSender(assignmentId);
    const { content } = block;
    const narration = useNarration(
        `block-${block.id}`,
        [content.prompt, ...content.options.map(({ label }) => label)],
        true,
    );

    function choose() {
        if (!choice) return;
        sender.send(
            {
                attemptId: attempt.id,
                blockId: block.id,
                tryNumber: 1,
                answer: { kind: 'hook', choice },
            },
            onNext,
        );
    }

    return (
        <ScreenCard aria-labelledby={`block-${block.id}`}>
            <ScreenHeading id={`block-${block.id}`}>
                <Spoken
                    text={content.prompt}
                    sentence={narration.sentenceIn(0)}
                />
            </ScreenHeading>
            <NarrationControls narration={narration} />
            {content.illustration && (
                <Illustration
                    name={content.illustration}
                    className="mx-auto max-w-64"
                />
            )}
            {content.diagram && (
                <DiagramPicture
                    diagram={content.diagram}
                    className="mx-auto max-w-64"
                />
            )}
            <OptionPicker
                name={`hook-${block.id}`}
                legend={content.prompt}
                options={content.options}
                value={choice}
                onChange={setChoice}
                disabled={Boolean(saved)}
                reading={optionBeingRead(narration, content.options, 1)}
            />
            <p className="bg-student-surface text-primary-deep rounded-2xl px-4 py-3 font-semibold">
                Ini pemanasan. Semua jawaban boleh.
            </p>
            {sender.offline && <OfflineNote onRetry={sender.retry} />}
            {saved ? (
                <NextButton className="w-full sm:w-auto" onClick={onNext}>
                    Lanjut
                </NextButton>
            ) : (
                <Button
                    feel="chunky"
                    className="w-full sm:w-auto"
                    disabled={!choice || sender.sending}
                    onClick={choose}
                >
                    Pilih ini
                </Button>
            )}
        </ScreenCard>
    );
}

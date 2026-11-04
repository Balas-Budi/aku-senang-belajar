import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Illustration } from './illustration';
import { answersFor } from './queries';
import {
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

    function choose() {
        if (saved) return onNext();
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
                {content.prompt}
            </ScreenHeading>
            {content.illustration && (
                <Illustration
                    name={content.illustration}
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
            />
            <p className="bg-student-surface text-primary-deep rounded-2xl px-4 py-3 font-semibold">
                Ini pemanasan. Semua jawaban boleh.
            </p>
            {sender.offline && <OfflineNote onRetry={sender.retry} />}
            <Button
                feel="chunky"
                className="w-full sm:w-auto"
                disabled={!choice || sender.sending}
                onClick={choose}
            >
                {saved ? 'Lanjut' : 'Pilih ini'}
            </Button>
        </ScreenCard>
    );
}

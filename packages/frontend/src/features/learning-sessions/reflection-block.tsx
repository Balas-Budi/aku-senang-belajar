import { useState, type ChangeEvent } from 'react';
import { CheckIcon } from '../../components/icons/check-icon';
import { requestErrorMessage } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { useErrorToast } from '../../components/ui/toast';
import { answersFor, useSubmit } from './queries';
import {
    OfflineNote,
    ReasonField,
    ScreenCard,
    ScreenHeading,
    type BlockProps,
} from './session-ui';
import { useAnswerSender } from './use-answer-sender';

function Chip({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <label className="border-border text-primary-deep has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-ring flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 bg-white px-4 font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-disabled:cursor-default">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="sr-only"
            />
            {checked && <CheckIcon className="size-[1em]" />}
            {label}
        </label>
    );
}

function toggled(list: string[], topic: string) {
    return list.includes(topic)
        ? list.filter((item) => item !== topic)
        : [...list, topic];
}

export function ReflectionBlock({
    assignmentId,
    attempt,
    block,
    teacher,
}: BlockProps<'reflection'>) {
    const saved = answersFor(attempt, block.id).at(0)?.answer;
    const sent = saved?.kind === 'reflection' ? saved : null;
    const [understood, setUnderstood] = useState(sent?.understood ?? []);
    const [confusing, setConfusing] = useState(sent?.confusing ?? []);
    const [nothing, setNothing] = useState(false);
    const [note, setNote] = useState(sent?.note ?? '');
    const sender = useAnswerSender(assignmentId);
    const submit = useSubmit(assignmentId);
    const showError = useErrorToast();
    const { topics } = block.content;

    function finish() {
        const close = () =>
            submit.mutate(attempt.id, {
                onError: (error) => showError(requestErrorMessage(error)),
            });
        if (sent) return close();
        sender.send(
            {
                attemptId: attempt.id,
                blockId: block.id,
                tryNumber: 1,
                answer: {
                    kind: 'reflection',
                    understood,
                    confusing,
                    ...(note.trim() ? { note: note.trim() } : {}),
                },
            },
            close,
        );
    }

    return (
        <ScreenCard aria-labelledby={`block-${block.id}`}>
            <div>
                <ScreenHeading id={`block-${block.id}`}>
                    Sebelum selesai, cerita sedikit, yuk
                </ScreenHeading>
                <p className="text-muted-foreground mt-2 leading-relaxed">
                    Jawab sejujurnya. Ini membantu {teacher} tahu cara
                    membantumu.
                </p>
            </div>
            <fieldset disabled={Boolean(sent)} className="space-y-2">
                <legend className="font-display text-primary-deep mb-2 text-[1.1em] font-semibold">
                    Yang sudah aku pahami
                </legend>
                <div className="flex flex-wrap gap-2">
                    {topics.map((topic) => (
                        <Chip
                            key={topic}
                            label={topic}
                            checked={understood.includes(topic)}
                            onChange={() =>
                                setUnderstood((list) => toggled(list, topic))
                            }
                        />
                    ))}
                </div>
            </fieldset>
            <fieldset disabled={Boolean(sent)} className="space-y-2">
                <legend className="font-display text-primary-deep mb-2 text-[1.1em] font-semibold">
                    Yang masih membingungkan
                </legend>
                <div className="flex flex-wrap gap-2">
                    {topics.map((topic) => (
                        <Chip
                            key={topic}
                            label={topic}
                            checked={confusing.includes(topic)}
                            onChange={() => {
                                setNothing(false);
                                setConfusing((list) => toggled(list, topic));
                            }}
                        />
                    ))}
                    <Chip
                        label="Tidak ada"
                        checked={nothing}
                        onChange={(event) => {
                            setNothing(event.target.checked);
                            if (event.target.checked) setConfusing([]);
                        }}
                    />
                </div>
            </fieldset>
            <ReasonField
                id={`note-${block.id}`}
                label="Mau cerita lebih? (boleh dilewati)"
                value={note}
                onChange={setNote}
                disabled={Boolean(sent)}
            />
            {sender.offline && <OfflineNote onRetry={sender.retry} />}
            <Button
                feel="chunky"
                className="w-full sm:w-auto"
                disabled={sender.sending || submit.isPending}
                onClick={finish}
            >
                {submit.isPending ? 'Menyimpan…' : 'Selesai'}
            </Button>
        </ScreenCard>
    );
}

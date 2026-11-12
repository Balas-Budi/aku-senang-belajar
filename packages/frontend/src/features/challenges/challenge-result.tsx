import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { choiceBox } from '../studio/studio-labels';
import { ChallengeError } from './challenge-error';
import { ChoiceBars, optionLabel } from './choice-bars';
import { useChallengeAction, type TeacherChallenge } from './queries';

const MIN_TO_GROUP = 3;

export const answeredLine = ({ answered, units, mode }: TeacherChallenge) =>
    `${answered} dari ${units}${mode === 'group' ? ' kelompok' : ''} sudah menjawab`;

export function ChallengeResult({
    classId,
    challenge,
    announce,
    onClose,
}: {
    classId: number;
    challenge: TeacherChallenge;
    announce: (text: string) => void;
    onClose: () => void;
}) {
    const show = useChallengeAction(classId, true);
    const group = useChallengeAction(classId);
    const live = challenge.state === 'revealed';
    const { answers, clusters, options } = challenge;
    const shown = new Set(
        show.isPending && show.variables.action === 'show'
            ? show.variables.answerIds
            : answers.filter((answer) => answer.shown).map(({ id }) => id),
    );
    const few = answers.length < MIN_TO_GROUP;

    const toggle = (id: number, on: boolean) =>
        show.mutate(
            {
                action: 'show',
                answerIds: answers
                    .map((answer) => answer.id)
                    .filter((other) => (other === id ? on : shown.has(other))),
            },
            {
                onSuccess: () =>
                    announce(
                        on
                            ? 'Alasan ditampilkan ke kelas.'
                            : 'Alasan tidak lagi ditampilkan ke kelas.',
                    ),
            },
        );

    return (
        <>
            <div className="space-y-1">
                <p className="font-semibold">
                    {live
                        ? 'Hasil sedang ditampilkan ke siswa'
                        : 'Hasil tantangan terakhir'}
                </p>
                <p className="text-lg break-words">{challenge.prompt}</p>
                <p className="tabular-nums">{answeredLine(challenge)}</p>
            </div>
            <ChoiceBars options={options} counts={challenge.counts} />
            <section
                aria-labelledby="challenge-reasons-title"
                className="space-y-1"
            >
                <h3 id="challenge-reasons-title" className="font-semibold">
                    Alasan siswa
                </h3>
                {answers.length === 0 ? (
                    <p className="text-muted-foreground">Belum ada jawaban.</p>
                ) : (
                    <>
                        <p className="text-muted-foreground text-sm">
                            {live
                                ? 'Tanpa nama. Centang alasan yang boleh dilihat siswa di layar mereka.'
                                : 'Tanpa nama.'}
                        </p>
                        <ul className="divide-paper-edge divide-y">
                            {answers.map((answer) => (
                                <li
                                    key={answer.id}
                                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
                                >
                                    <p
                                        id={`challenge-answer-${answer.id}`}
                                        className="min-w-0 flex-1 basis-64 break-words"
                                    >
                                        <span className="text-muted-foreground block text-sm">
                                            Memilih:{' '}
                                            {optionLabel(
                                                options,
                                                answer.choice,
                                            )}
                                        </span>
                                        {answer.reason}
                                    </p>
                                    {live ? (
                                        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={shown.has(answer.id)}
                                                onChange={(event) =>
                                                    toggle(
                                                        answer.id,
                                                        event.target.checked,
                                                    )
                                                }
                                                aria-describedby={`challenge-answer-${answer.id}`}
                                                className={cn(
                                                    choiceBox,
                                                    'mt-0',
                                                )}
                                            />
                                            Tampilkan ke kelas
                                        </label>
                                    ) : (
                                        answer.shown && (
                                            <p className="shrink-0 text-sm font-medium">
                                                Ditampilkan ke kelas
                                            </p>
                                        )
                                    )}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                <ChallengeError error={show.error} />
            </section>
            {(live || clusters) && (
                <section
                    aria-labelledby="challenge-groups-title"
                    className="space-y-3"
                >
                    <h3 id="challenge-groups-title" className="font-semibold">
                        Kelompok alasan
                    </h3>
                    {live && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <Button
                                variant="outline"
                                disabled={few}
                                aria-disabled={group.isPending}
                                className="aria-disabled:opacity-60"
                                onClick={() => {
                                    if (group.isPending) return;
                                    group.mutate(
                                        { action: 'cluster' },
                                        {
                                            onSuccess: () =>
                                                announce(
                                                    'Alasan sudah dikelompokkan.',
                                                ),
                                        },
                                    );
                                }}
                            >
                                {group.isPending
                                    ? 'AI sedang mengelompokkan…'
                                    : 'Kelompokkan alasan dengan AI'}
                            </Button>
                            {few && (
                                <p className="text-muted-foreground text-sm">
                                    Perlu setidaknya {MIN_TO_GROUP} jawaban.
                                </p>
                            )}
                        </div>
                    )}
                    {group.isPending && (
                        <Alert role="status">
                            AI sedang membaca alasan siswa. Ini bisa sampai satu
                            menit.
                        </Alert>
                    )}
                    <ChallengeError error={group.error} />
                    {clusters?.map((cluster, index) => (
                        <section
                            key={index}
                            aria-labelledby={`challenge-group-${index}`}
                            className="border-paper-edge space-y-1 rounded-lg border p-3"
                        >
                            <h4
                                id={`challenge-group-${index}`}
                                className="font-semibold break-words"
                            >
                                {cluster.label}
                            </h4>
                            <p className="break-words">
                                <span className="text-ai-suggestion font-medium">
                                    Saran AI:
                                </span>{' '}
                                {cluster.note}
                            </p>
                            <ul className="list-disc space-y-1 pl-5">
                                {answers
                                    .filter(({ id }) =>
                                        cluster.answerIds.includes(id),
                                    )
                                    .map((answer) => (
                                        <li
                                            key={answer.id}
                                            className="break-words"
                                        >
                                            {answer.reason}{' '}
                                            <span className="text-muted-foreground text-sm">
                                                (memilih{' '}
                                                {optionLabel(
                                                    options,
                                                    answer.choice,
                                                )}
                                                )
                                            </span>
                                        </li>
                                    ))}
                            </ul>
                        </section>
                    ))}
                </section>
            )}
            {live && (
                <Button variant="outline" onClick={onClose}>
                    Tutup tantangan
                </Button>
            )}
        </>
    );
}

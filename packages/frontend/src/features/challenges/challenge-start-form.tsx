import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { fieldErrorText, TextAreaField } from '../../components/form-field';
import { ErrorToast, RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ApiError } from '../../lib/api';
import { choiceBox, choiceCard } from '../studio/studio-labels';
import { ChallengeError } from './challenge-error';
import {
    challengeConflict,
    challengeSourcesQuery,
    type ChallengeMode,
    type ChallengeStart,
} from './queries';

const origins = { missions: 'Dari misi kelas ini', own: 'Tulis sendiri' };
const modes = {
    solo: { label: 'Sendiri', help: 'Setiap siswa mengirim jawabannya.' },
    group: { label: 'Kelompok', help: 'Satu jawaban untuk satu kelompok.' },
};
const optionLetters = ['A', 'B', 'C', 'D'];

/** Answer options as an A–D list, easier to scan than one comma sentence. */
export function OptionList({
    labels,
    inline,
}: {
    labels: string[];
    /** Inside a <label>, only phrasing content is valid, so spans stand in for the list. */
    inline?: boolean;
}) {
    const List = inline ? 'span' : 'ol';
    const Item = inline ? 'span' : 'li';
    return (
        <List className="grid gap-2 @xl:grid-cols-2">
            {labels.map((label, index) => (
                <Item
                    key={index}
                    className="border-paper-edge flex items-start gap-2.5 rounded-xl border bg-white px-3 py-2"
                >
                    <span
                        aria-hidden="true"
                        className="bg-secondary text-primary-deep flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                    >
                        {optionLetters[index] ?? index + 1}
                    </span>
                    <span className="min-w-0 pt-0.5 leading-snug break-words">
                        {label}
                    </span>
                </Item>
            ))}
        </List>
    );
}

const lettered = (labels: string[]) =>
    labels.map((label, index) => ({ id: 'abcd'.charAt(index), label }));

export function StartForm({
    classId,
    error,
    pending,
    onStart,
}: {
    classId: number;
    error: unknown;
    pending: boolean;
    onStart: (input: ChallengeStart) => void;
}) {
    const sources = useQuery(challengeSourcesQuery(classId));
    const [picked, setPicked] = useState<keyof typeof origins | null>(null);
    const [mode, setMode] = useState<ChallengeMode>('solo');
    const list = sources.data?.sources;
    const origin = picked ?? (list?.length === 0 ? 'own' : 'missions');
    const optionsError = fieldErrorText(error, 'options');
    const sizeError = fieldErrorText(error, 'groupSize');

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const source = list?.find(
            ({ blockId }) => String(blockId) === data.get('source'),
        );
        if (origin === 'missions' && !source) return;
        onStart({
            prompt: source ? source.prompt : String(data.get('prompt') ?? ''),
            options: lettered(
                source
                    ? source.options.map(({ label }) => label)
                    : data
                          .getAll('option')
                          .map((value) => String(value).trim())
                          .filter(Boolean),
            ),
            mode,
            groupSize:
                mode === 'group' ? Number(data.get('groupSize')) : undefined,
        });
    };

    return (
        <form className="space-y-4" onSubmit={submit}>
            <fieldset>
                <legend className="mb-2 font-semibold">
                    Sumber pertanyaan
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    {(['missions', 'own'] as const).map((value) => (
                        <label key={value} className={choiceCard}>
                            <input
                                type="radio"
                                name="origin"
                                value={value}
                                checked={origin === value}
                                onChange={() => setPicked(value)}
                                className={choiceBox}
                            />
                            <span className="font-medium">
                                {origins[value]}
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
            <fieldset
                hidden={origin !== 'missions'}
                disabled={origin !== 'missions'}
            >
                <legend className="mb-2 font-semibold">
                    Pertanyaan dari misi
                </legend>
                {sources.isPending ? (
                    <p role="status">Memuat pertanyaan dari misi…</p>
                ) : sources.isError ? (
                    <div className="space-y-3">
                        <RequestError error={sources.error} />
                        <Button
                            variant="outline"
                            onClick={() => {
                                void sources.refetch();
                            }}
                        >
                            Muat ulang pertanyaan
                        </Button>
                    </div>
                ) : sources.data.sources.length === 0 ? (
                    <p>
                        Misi kelas ini belum punya pertanyaan tantangan. Tulis
                        pertanyaan Anda sendiri.
                    </p>
                ) : (
                    <div className="@container grid gap-3">
                        {sources.data.sources.map((source) => (
                            <label
                                key={source.blockId}
                                className="border-paper-edge hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-student-surface has-[:focus-visible]:outline-ring flex cursor-pointer flex-col gap-3 rounded-2xl border-2 bg-white p-4 break-words has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 sm:p-5"
                            >
                                <span className="flex items-start gap-3">
                                    <input
                                        type="radio"
                                        name="source"
                                        value={source.blockId}
                                        required
                                        aria-labelledby={`source-${source.blockId}-mission source-${source.blockId}-prompt`}
                                        aria-describedby={`source-${source.blockId}-options`}
                                        className="accent-primary mt-0.5 size-5 shrink-0 focus-visible:outline-none"
                                    />
                                    <span
                                        id={`source-${source.blockId}-mission`}
                                        className="bg-secondary text-primary-deep min-w-0 rounded-lg px-2.5 py-0.5 text-sm font-semibold"
                                    >
                                        Misi: {source.mission}
                                    </span>
                                </span>
                                <span
                                    id={`source-${source.blockId}-prompt`}
                                    className="block text-base leading-relaxed font-semibold sm:pl-8 sm:text-lg"
                                >
                                    {source.prompt}
                                </span>
                                <span
                                    id={`source-${source.blockId}-options`}
                                    className="block space-y-1.5 sm:pl-8"
                                >
                                    <span className="text-muted-foreground block text-sm font-semibold">
                                        Pilihan jawaban
                                    </span>
                                    <OptionList
                                        inline
                                        labels={source.options.map(
                                            ({ label }) => label,
                                        )}
                                    />
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </fieldset>
            <fieldset
                hidden={origin !== 'own'}
                disabled={origin !== 'own'}
                className="space-y-4"
            >
                <legend className="sr-only">Pertanyaan Anda sendiri</legend>
                <TextAreaField
                    id="challenge-prompt"
                    name="prompt"
                    label="Pertanyaan"
                    hint="Paling banyak 300 karakter."
                    error={error}
                    required
                    maxLength={300}
                />
                <fieldset
                    aria-describedby={
                        optionsError
                            ? 'challenge-options-hint challenge-options-error'
                            : 'challenge-options-hint'
                    }
                >
                    <legend className="font-medium">Pilihan jawaban</legend>
                    <p
                        id="challenge-options-hint"
                        className="text-muted-foreground text-sm"
                    >
                        Isi 2 sampai 4 pilihan. Pilihan C dan D boleh kosong.
                    </p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {optionLetters.map((letter, index) => (
                            <div key={letter} className="space-y-1">
                                <label
                                    htmlFor={`challenge-option-${letter}`}
                                    className="block text-sm font-medium"
                                >
                                    Pilihan {letter}
                                </label>
                                <Input
                                    id={`challenge-option-${letter}`}
                                    name="option"
                                    required={index < 2}
                                    maxLength={120}
                                    aria-invalid={optionsError !== null}
                                />
                            </div>
                        ))}
                    </div>
                    {optionsError && (
                        <p
                            id="challenge-options-error"
                            className="text-destructive mt-2"
                        >
                            {optionsError}
                        </p>
                    )}
                </fieldset>
            </fieldset>
            <fieldset>
                <legend className="mb-2 font-semibold">Cara menjawab</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    {(['solo', 'group'] as const).map((value) => (
                        <label key={value} className={choiceCard}>
                            <input
                                type="radio"
                                name="mode"
                                value={value}
                                checked={mode === value}
                                onChange={() => setMode(value)}
                                className={choiceBox}
                            />
                            <span>
                                <span className="block font-medium">
                                    {modes[value].label}
                                </span>
                                <span className="block text-sm">
                                    {modes[value].help}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
            {mode === 'group' && (
                <div className="space-y-2">
                    <label
                        htmlFor="challenge-group-size"
                        className="block font-medium"
                    >
                        Jumlah siswa per kelompok
                    </label>
                    <Input
                        id="challenge-group-size"
                        name="groupSize"
                        type="number"
                        inputMode="numeric"
                        min={2}
                        max={5}
                        required
                        aria-invalid={sizeError !== null}
                        aria-describedby="challenge-group-size-hint"
                        className="max-w-40"
                    />
                    <p
                        id="challenge-group-size-hint"
                        className={
                            sizeError
                                ? 'text-destructive'
                                : 'text-muted-foreground text-sm'
                        }
                    >
                        {sizeError ??
                            'Isi 2 sampai 5. Kelompok dibentuk dari daftar siswa, urut nama.'}
                    </p>
                </div>
            )}
            {challengeConflict(error) ? null : error instanceof ApiError &&
              error.status === 400 ? (
                <ErrorToast
                    error={error}
                    message={
                        origin === 'missions' && !sizeError
                            ? 'Pertanyaan ini tidak bisa dipakai apa adanya. Pilih pertanyaan lain atau tulis sendiri.'
                            : 'Tantangan belum dimulai. Perbaiki isian yang ditandai, lalu coba lagi.'
                    }
                />
            ) : (
                <ChallengeError error={error} />
            )}
            <Button
                type="submit"
                disabled={origin === 'missions' && !list?.length}
                aria-disabled={pending}
                className="aria-disabled:opacity-60"
            >
                {pending ? 'Memulai…' : 'Mulai tantangan'}
            </Button>
        </form>
    );
}

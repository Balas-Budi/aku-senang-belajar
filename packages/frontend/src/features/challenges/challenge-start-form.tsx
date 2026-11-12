import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { fieldErrorText, TextAreaField } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ApiError } from '../../lib/api';
import { choiceBox, choiceCard, joined } from '../studio/studio-labels';
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
                    <div className="grid gap-2">
                        {sources.data.sources.map((source) => (
                            <label key={source.blockId} className={choiceCard}>
                                <input
                                    type="radio"
                                    name="source"
                                    value={source.blockId}
                                    required
                                    className={choiceBox}
                                />
                                <span className="min-w-0 break-words">
                                    <span className="block text-sm">
                                        Misi: {source.mission}
                                    </span>
                                    <span className="block font-medium">
                                        {source.prompt}
                                    </span>
                                    <span className="block text-sm">
                                        Pilihan:{' '}
                                        {joined(
                                            source.options.map(
                                                ({ label }) => label,
                                            ),
                                        )}
                                    </span>
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
                <p role="alert" className="text-destructive">
                    {origin === 'missions' && !sizeError
                        ? 'Pertanyaan ini tidak bisa dipakai apa adanya. Pilih pertanyaan lain atau tulis sendiri.'
                        : 'Tantangan belum dimulai. Perbaiki isian yang ditandai, lalu coba lagi.'}
                </p>
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

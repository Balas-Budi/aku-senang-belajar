import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { fieldErrorText } from '../../components/form-field';
import {
    RequestError,
    requestErrorMessage,
} from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { inputVariants } from '../../components/ui/input';
import { textLink } from '../../components/ui/text-link';
import { useErrorToast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import {
    OptionPicker,
    ScreenCard,
    ScreenHeading,
} from '../learning-sessions/session-ui';
import { ChoiceBars, optionLabel } from './choice-bars';
import {
    errorCode,
    studentChallengeQuery,
    useAnswerChallenge,
    type Given,
    type StudentChallenge,
} from './queries';

const subheading = 'font-display text-primary-deep text-[1.2em] font-semibold';
const note =
    'bg-student-surface text-primary-deep rounded-2xl px-4 py-3 font-semibold';

function AnswerForm({
    challenge,
    error,
    pending,
    onSend,
}: {
    challenge: StudentChallenge;
    error: unknown;
    pending: boolean;
    onSend: (answer: Given) => void;
}) {
    const [choice, setChoice] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const ready = choice !== null && reason.trim().length > 0;
    const reasonError = fieldErrorText(error, 'reason');

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (choice && ready) onSend({ choice, reason: reason.trim() });
    };

    return (
        <form className="space-y-5" onSubmit={submit}>
            <OptionPicker
                name="challenge-choice"
                legend={challenge.prompt}
                options={challenge.options}
                value={choice}
                onChange={setChoice}
            />
            <div className="space-y-2">
                <label
                    htmlFor="challenge-reason"
                    className="font-display text-primary-deep block text-[1.1em] font-semibold"
                >
                    Kenapa kamu memilih itu?
                </label>
                <textarea
                    id="challenge-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    maxLength={300}
                    aria-invalid={reasonError !== null}
                    aria-describedby={
                        reasonError ? 'challenge-reason-error' : undefined
                    }
                    className={cn(
                        inputVariants({ feel: 'chunky' }),
                        'min-h-28 resize-y py-3 text-[1em] leading-relaxed',
                    )}
                />
                {reasonError && (
                    <p id="challenge-reason-error" className="text-destructive">
                        {reasonError}
                    </p>
                )}
            </div>
            <div className="space-y-2">
                <Button
                    type="submit"
                    feel="chunky"
                    className="w-full aria-disabled:opacity-60 sm:w-auto"
                    disabled={!ready}
                    aria-disabled={pending}
                >
                    {pending ? 'Mengirim…' : 'Kirim jawaban'}
                </Button>
                {!ready && (
                    <p className="text-muted-foreground">
                        {choice === null
                            ? 'Pilih satu jawaban dulu.'
                            : 'Tulis alasanmu dulu, ya.'}
                    </p>
                )}
            </div>
        </form>
    );
}

function Running({ challenge }: { challenge: StudentChallenge }) {
    const send = useAnswerChallenge();
    const showError = useErrorToast();
    const { answered, group, options, result } = challenge;
    const phase = result ? 'result' : answered ? 'sent' : 'form';
    const own = group
        ? { answer: 'Jawaban kelompokmu', choice: 'Pilihan kelompokmu' }
        : { answer: 'Jawabanmu', choice: 'Pilihanmu' };

    const answer = (given: Given) => {
        if (send.isPending) return;
        send.mutate(
            { challengeId: challenge.id, ...given },
            {
                onError: (error) => {
                    const shown =
                        fieldErrorText(error, 'reason') !== null ||
                        (error instanceof ApiError &&
                            [404, 409].includes(error.status));
                    if (!shown) showError(requestErrorMessage(error));
                },
            },
        );
    };

    return (
        <ScreenCard
            key={phase}
            aria-labelledby="challenge-heading"
            className="mx-auto max-w-3xl"
        >
            <ScreenHeading
                id="challenge-heading"
                className={phase === 'form' ? 'text-primary text-[1.1em]' : ''}
            >
                {phase === 'result'
                    ? 'Hasil tantangan kelas'
                    : phase === 'sent'
                      ? 'Jawaban terkirim'
                      : 'Tantangan kelas'}
            </ScreenHeading>
            {phase === 'sent' && (
                <p className={note}>Tunggu gurumu menampilkan hasilnya, ya.</p>
            )}
            <p className="font-display text-primary-deep text-[1.35em] leading-snug font-medium text-pretty break-words">
                {challenge.prompt}
            </p>
            {group && (
                <div className="bg-student-accent-soft text-student-accent-ink rounded-2xl px-4 py-3">
                    <p className="font-bold">Kelompokmu: {group.name}</p>
                    <p className="break-words">{group.members.join(', ')}</p>
                    {phase !== 'result' && (
                        <p>Satu jawaban untuk satu kelompok.</p>
                    )}
                </div>
            )}
            {phase === 'form' && (
                <AnswerForm
                    challenge={challenge}
                    error={send.error}
                    pending={send.isPending}
                    onSend={answer}
                />
            )}
            {phase === 'sent' && answered && (
                <>
                    {errorCode(send.error) === 'ALREADY_ANSWERED' && (
                        <p role="status">
                            {group
                                ? 'Temanmu sudah lebih dulu mengirim jawaban untuk kelompokmu.'
                                : 'Jawabanmu sudah terkirim sebelumnya.'}
                        </p>
                    )}
                    <section
                        aria-labelledby="challenge-own-title"
                        className="space-y-1"
                    >
                        <h2 id="challenge-own-title" className={subheading}>
                            {own.answer}
                        </h2>
                        <p className="font-semibold break-words">
                            {optionLabel(options, answered.choice)}
                        </p>
                        <p className="leading-relaxed break-words">
                            {answered.reason}
                        </p>
                    </section>
                </>
            )}
            {result && (
                <>
                    {!answered && (
                        <p className={note}>
                            {own.answer} belum terkirim saat gurumu menampilkan
                            hasilnya. Tidak apa-apa, yuk lihat pilihan kelasmu.
                        </p>
                    )}
                    <section
                        aria-labelledby="challenge-class-title"
                        className="space-y-3"
                    >
                        <h2 id="challenge-class-title" className={subheading}>
                            Pilihan kelasmu
                        </h2>
                        <ChoiceBars
                            options={options}
                            counts={result.counts}
                            own={answered?.choice}
                            ownLabel={own.choice}
                        />
                    </section>
                    <section
                        aria-labelledby="challenge-reasons-title"
                        className="space-y-3"
                    >
                        <h2 id="challenge-reasons-title" className={subheading}>
                            Alasan dari kelasmu
                        </h2>
                        {result.reasons.length === 0 ? (
                            <p className="text-muted-foreground">
                                Gurumu belum menampilkan alasan.
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {result.reasons.map((given, index) => (
                                    <li
                                        key={index}
                                        className="bg-student-surface rounded-2xl px-4 py-3 break-words"
                                    >
                                        <span className="text-primary-deep block text-[0.9em] font-bold">
                                            Memilih{' '}
                                            {optionLabel(options, given.choice)}
                                        </span>
                                        {given.reason}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </ScreenCard>
    );
}

export function ClassChallenge() {
    const query = useQuery(studentChallengeQuery());
    return (
        <div className="space-y-6">
            <Link to="/student" className={textLink}>
                Kembali ke beranda
            </Link>
            {query.data ? (
                query.data.challenge ? (
                    <Running
                        key={query.data.challenge.id}
                        challenge={query.data.challenge}
                    />
                ) : (
                    <ScreenCard
                        aria-labelledby="challenge-gone"
                        className="mx-auto max-w-3xl"
                    >
                        <ScreenHeading id="challenge-gone">
                            Tidak ada tantangan saat ini
                        </ScreenHeading>
                        <p className="text-lg leading-relaxed">
                            Tantangan kelas sudah ditutup gurumu atau belum
                            dimulai. Kalau ada tantangan baru, kartunya muncul
                            di beranda.
                        </p>
                        <Link
                            to="/student"
                            className={buttonVariants({ feel: 'chunky' })}
                        >
                            Kembali ke beranda
                        </Link>
                    </ScreenCard>
                )
            ) : query.isPending ? (
                <p role="status" className="text-muted-foreground">
                    Sebentar, kita buka tantangannya…
                </p>
            ) : (
                <div className="space-y-3">
                    <RequestError error={query.error} />
                    <Button
                        feel="chunky"
                        onClick={() => {
                            void query.refetch();
                        }}
                    >
                        Muat ulang tantangan
                    </Button>
                </div>
            )}
        </div>
    );
}

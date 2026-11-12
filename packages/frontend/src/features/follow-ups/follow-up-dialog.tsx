import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { fieldErrorText, TextAreaField } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button, buttonVariants } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { ApiError } from '../../lib/api';
import { stateLabel } from '../results/analysis-state';
import {
    type Competency,
    type SessionResults,
    sessionResultsQuery,
    type StudentResult,
} from '../results/queries';
import { StatusChip } from '../results/status';
import { choiceBox, choiceCard, focusHeading } from '../studio/studio-labels';
import { type FollowUpKind, useCreateFollowUp } from './queries';

export const kindLabels: Record<FollowUpKind, string> = {
    reinforce: 'Penguatan',
    enrich: 'Pengayaan',
    discuss: 'Diskusi kelas',
    reteach: 'Ajar ulang',
};

const kindHelp: Record<FollowUpKind, string> = {
    reinforce: 'Latihan ulang di jalur siswa',
    enrich: 'Tantangan tambahan misi ini',
    discuss: 'Untuk Anda; tidak muncul di layar siswa.',
    reteach: 'Untuk Anda; tidak muncul di layar siswa.',
};

const refusals: Record<string, string> = {
    NO_QUESTIONS:
        'Misi ini belum punya soal untuk kompetensi ini. Pilih jenis lain.',
    NO_EXTRA: 'Misi ini tidak punya tantangan tambahan.',
};

const busy = 'aria-disabled:opacity-60';

export const practised = (kind: FollowUpKind) =>
    kind === 'reinforce' || kind === 'enrich';

function shownStatus(student: StudentResult, competencyId: number) {
    return student.analysis === 'succeeded'
        ? student.competencies.find(
              (cell) => cell.competencyId === competencyId,
          )?.status
        : undefined;
}

function proposal(
    results: SessionResults,
    competencyId: number,
    kind: FollowUpKind,
) {
    return results.students
        .filter((student) => {
            if (kind === 'enrich')
                return results.competencies.every(
                    ({ id }) => shownStatus(student, id) === 'visible',
                );
            const status = shownStatus(student, competencyId);
            return status === 'developing' || status === 'needs_verification';
        })
        .map(({ id }) => id);
}

function StudentState({
    student,
    competencyId,
}: {
    student: StudentResult;
    competencyId: number;
}) {
    const status = shownStatus(student, competencyId);
    if (status) return <StatusChip status={status} />;
    return (
        <span className="text-muted-foreground text-sm">
            {student.analysis === 'succeeded'
                ? 'Belum ada status'
                : stateLabel(student.progress, student.analysis)}
        </span>
    );
}

function FollowUpForm({
    prefix,
    results,
    competency,
    studentId,
    create,
    onCancel,
}: {
    prefix: string;
    results: SessionResults;
    competency: Competency;
    studentId?: number;
    create: ReturnType<typeof useCreateFollowUp>;
    onCancel: () => void;
}) {
    const proposalOf = (next: FollowUpKind) =>
        studentId === undefined
            ? proposal(results, competency.id, next)
            : results.students
                  .filter(({ id }) => id === studentId)
                  .map(({ id }) => id);
    const [kind, setKind] = useState<FollowUpKind>('reinforce');
    const [ticked, setTicked] = useState(() => proposalOf('reinforce'));
    const { error } = create;
    const refusal =
        error instanceof ApiError ? refusals[error.body.name] : undefined;
    const studentsError = fieldErrorText(error, 'studentIds');
    const emptyProposal =
        results.students.length > 0 && proposalOf(kind).length === 0;
    const kinds = (
        ['reinforce', 'enrich', 'discuss', 'reteach'] as const
    ).filter((value) => value !== 'enrich' || results.extra);
    const studentsHelp = [
        emptyProposal && `${prefix}-empty`,
        studentsError && `${prefix}-students-error`,
    ]
        .filter(Boolean)
        .join(' ');

    const choose = (next: FollowUpKind) => {
        create.reset();
        setKind(next);
        setTicked(proposalOf(next));
    };
    const tick = (id: number, on: boolean) =>
        setTicked((current) =>
            on ? [...current, id] : current.filter((item) => item !== id),
        );
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (create.isPending) return;
        const note = String(
            new FormData(event.currentTarget).get('note') ?? '',
        ).trim();
        create.mutate({
            assignmentId: results.assignment.id,
            kind,
            competencyId: kind === 'enrich' ? undefined : competency.id,
            studentIds: results.students
                .filter(({ id }) => ticked.includes(id))
                .map(({ id }) => id),
            note: note || undefined,
        });
    };

    return (
        <form className="mt-5 space-y-5" onSubmit={submit}>
            <fieldset
                aria-describedby={refusal ? `${prefix}-refusal` : undefined}
            >
                <legend className="mb-2 font-semibold">
                    Jenis tindak lanjut
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    {kinds.map((value) => (
                        <label key={value} className={choiceCard}>
                            <input
                                type="radio"
                                name="kind"
                                value={value}
                                checked={kind === value}
                                onChange={() => choose(value)}
                                className={choiceBox}
                            />
                            <span>
                                <span className="block font-medium">
                                    {kindLabels[value]}
                                </span>
                                <span className="block text-sm">
                                    {kindHelp[value]}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>
                {refusal && (
                    <Alert
                        id={`${prefix}-refusal`}
                        tone="attention"
                        role="alert"
                        className="mt-2"
                    >
                        {refusal}
                    </Alert>
                )}
            </fieldset>
            <fieldset aria-describedby={studentsHelp || undefined}>
                <legend className="mb-2 font-semibold">Siswa</legend>
                {emptyProposal && (
                    <p id={`${prefix}-empty`} className="mb-2">
                        Belum ada siswa yang cocok. Centang sendiri siswa yang
                        ingin Anda pilih.
                    </p>
                )}
                {results.students.length === 0 ? (
                    <p>Belum ada siswa di kelas ini.</p>
                ) : (
                    <ul className="grid gap-2">
                        {results.students.map((student) => (
                            <li key={student.id}>
                                <label className={choiceCard}>
                                    <input
                                        type="checkbox"
                                        checked={ticked.includes(student.id)}
                                        onChange={(event) =>
                                            tick(
                                                student.id,
                                                event.target.checked,
                                            )
                                        }
                                        aria-invalid={studentsError !== null}
                                        className={choiceBox}
                                    />
                                    <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                        <span className="min-w-0 font-medium break-words">
                                            {student.name}
                                        </span>
                                        <StudentState
                                            student={student}
                                            competencyId={competency.id}
                                        />
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
                {studentsError && (
                    <p
                        id={`${prefix}-students-error`}
                        className="text-destructive mt-2"
                    >
                        {studentsError}
                    </p>
                )}
            </fieldset>
            <TextAreaField
                id={`${prefix}-note`}
                name="note"
                label={
                    practised(kind)
                        ? 'Pesan untuk siswa (boleh kosong)'
                        : 'Catatan untuk Anda (boleh kosong)'
                }
                hint="Paling banyak 300 karakter."
                error={error}
                maxLength={300}
                rows={3}
            />
            {refusal ? null : error instanceof ApiError &&
              error.status === 400 ? (
                <p role="alert" className="text-destructive">
                    {fieldErrorText(error, 'competencyId') ??
                        'Tindak lanjut belum tersimpan. Perbaiki isian yang ditandai, lalu coba lagi.'}
                </p>
            ) : (
                <RequestError error={error} />
            )}
            <div className="flex flex-wrap gap-3">
                <Button
                    variant="outline"
                    disabled={create.isPending}
                    onClick={onCancel}
                >
                    Batal
                </Button>
                <Button
                    type="submit"
                    aria-disabled={create.isPending}
                    className={busy}
                >
                    {create.isPending ? 'Menyimpan…' : 'Simpan tindak lanjut'}
                </Button>
            </div>
        </form>
    );
}

function Saved({ classId, onClose }: { classId: number; onClose: () => void }) {
    const line = useRef<HTMLParagraphElement>(null);
    useEffect(() => line.current?.focus(), []);
    return (
        <div className="mt-5 space-y-4">
            <p
                ref={line}
                tabIndex={-1}
                className={`text-lg font-semibold ${focusHeading}`}
            >
                Tindak lanjut tersimpan.
            </p>
            <div className="flex flex-wrap gap-3">
                <Link
                    to={`/teacher/classes/${classId}/follow-ups`}
                    className={buttonVariants()}
                >
                    Lihat rencana tindak lanjut
                </Link>
                <Button variant="outline" onClick={onClose}>
                    Tutup
                </Button>
            </div>
        </div>
    );
}

function FollowUpContent({
    prefix,
    classId,
    assignmentId,
    competency,
    studentId,
    create,
    onClose,
}: {
    prefix: string;
    classId: number;
    assignmentId: number;
    competency: Competency;
    studentId?: number;
    create: ReturnType<typeof useCreateFollowUp>;
    onClose: () => void;
}) {
    const results = useQuery(sessionResultsQuery(classId, assignmentId));

    if (create.isSuccess) return <Saved classId={classId} onClose={onClose} />;

    if (!results.data)
        return results.isPending ? (
            <p role="status" className="mt-5">
                Memuat siswa…
            </p>
        ) : (
            <div className="mt-5 space-y-3">
                <RequestError error={results.error} />
                <Button
                    onClick={() => {
                        void results.refetch();
                    }}
                >
                    Muat ulang siswa
                </Button>
            </div>
        );

    return (
        <>
            <p className="text-muted-foreground mt-1 text-sm break-words">
                Misi {results.data.assignment.title}
            </p>
            <FollowUpForm
                prefix={prefix}
                results={results.data}
                competency={competency}
                studentId={studentId}
                create={create}
                onCancel={onClose}
            />
        </>
    );
}

export function FollowUpButton({
    classId,
    assignmentId,
    competency,
    studentId,
    context,
}: {
    classId: number;
    assignmentId: number;
    competency: Competency;
    studentId?: number;
    context: string;
}) {
    const [open, setOpen] = useState<boolean | null>(null);
    const create = useCreateFollowUp(classId);
    const prefix = `follow-up-${assignmentId}-${competency.id}`;
    const close = (dialog?: HTMLDialogElement) => {
        if (create.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        create.reset();
        setOpen(false);
    };

    return (
        <>
            <Button
                variant="outline"
                className="print:hidden"
                onClick={() => setOpen(true)}
            >
                Tindak lanjut
                <span className="sr-only"> {context}</span>
            </Button>
            {open !== null && (
                <Dialog
                    open={open}
                    onClose={close}
                    onCancel={(event) => {
                        if (create.isPending) event.preventDefault();
                    }}
                    aria-labelledby={`${prefix}-title`}
                    aria-describedby={`${prefix}-about`}
                    className="max-w-lg"
                >
                    <h2
                        id={`${prefix}-title`}
                        className="text-primary-deep text-xl font-bold"
                    >
                        Tindak lanjut
                    </h2>
                    <p id={`${prefix}-about`} className="mt-2 break-words">
                        <span className="font-semibold">{competency.code}</span>{' '}
                        {competency.description}
                    </p>
                    {open && (
                        <FollowUpContent
                            prefix={prefix}
                            classId={classId}
                            assignmentId={assignmentId}
                            competency={competency}
                            studentId={studentId}
                            create={create}
                            onClose={() => close()}
                        />
                    )}
                </Dialog>
            )}
        </>
    );
}

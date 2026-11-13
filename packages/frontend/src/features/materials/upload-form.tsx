import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { LicenceFields } from './licence-fields';
import { pdfLimits } from './pdf-field';
import { useUploadMaterial } from './queries';
import { subjects } from '../assignments/subject-art';
import { FormField, fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { CloseIcon } from '../../components/icons/close-icon';
import { UploadIcon } from '../../components/icons/workspace-icons';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';

const grades = [1, 2, 3, 4, 5, 6];

function FieldError({ id, message }: { id: string; message: string | null }) {
    return message ? (
        <p id={id} className="text-destructive">
            {message}
        </p>
    ) : null;
}

function sizeText(bytes: number) {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function PdfDrop({
    error,
    onFile,
}: {
    error: unknown;
    onFile: (file: File | null) => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [over, setOver] = useState(false);
    const message = fieldErrorText(error, 'pdf');
    return (
        <div className="space-y-2">
            <label
                htmlFor="pdf"
                data-over={over || undefined}
                className="border-primary/40 bg-student-surface hover:border-primary focus-within:outline-ring data-over:border-primary data-over:bg-secondary relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center focus-within:outline-3 focus-within:outline-offset-2"
            >
                <input
                    id="pdf"
                    name="pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    aria-invalid={message !== null}
                    aria-describedby={`pdf-hint${message ? ' pdf-error' : ''}`}
                    onDragEnter={() => setOver(true)}
                    onDragLeave={() => setOver(false)}
                    onDrop={() => setOver(false)}
                    onChange={(event) => {
                        const chosen = event.currentTarget.files?.[0] ?? null;
                        setFile(chosen);
                        onFile(chosen);
                    }}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <span
                    aria-hidden="true"
                    className="bg-primary flex size-12 items-center justify-center rounded-xl text-white"
                >
                    <UploadIcon />
                </span>
                {file ? (
                    <>
                        <span className="font-semibold break-all">
                            {file.name}
                        </span>
                        <span className="text-muted-foreground text-sm">
                            {sizeText(file.size)} ·{' '}
                            <span className="text-primary font-semibold underline">
                                Ganti file
                            </span>
                        </span>
                    </>
                ) : (
                    <>
                        <span className="text-primary-deep text-lg font-semibold">
                            Pilih file PDF
                        </span>
                        <span className="text-muted-foreground">
                            atau tarik file ke sini
                        </span>
                    </>
                )}
            </label>
            <p id="pdf-hint" className="text-muted-foreground text-sm">
                {pdfLimits}
            </p>
            <FieldError id="pdf-error" message={message} />
        </div>
    );
}

function GradePicker({ error }: { error: unknown }) {
    const message = fieldErrorText(error, 'grade');
    return (
        <fieldset
            className="space-y-2"
            aria-describedby={message ? 'grade-error' : undefined}
        >
            <legend className="mb-2 font-medium">Kelas</legend>
            <div className="grid grid-cols-6 gap-2">
                {grades.map((grade) => (
                    <label key={grade} className="relative">
                        <input
                            type="radio"
                            name="grade"
                            value={grade}
                            required
                            aria-label={`Kelas ${grade}`}
                            className="peer absolute inset-0 opacity-0"
                        />
                        <span
                            aria-hidden="true"
                            className="border-border peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-ring flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 bg-white text-lg font-semibold peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2"
                        >
                            {grade}
                        </span>
                    </label>
                ))}
            </div>
            <FieldError id="grade-error" message={message} />
        </fieldset>
    );
}

function SubjectSelect({ error }: { error: unknown }) {
    const message = fieldErrorText(error, 'subject');
    return (
        <div className="space-y-2">
            <label htmlFor="subject" className="block font-medium">
                Mata pelajaran
            </label>
            <select
                id="subject"
                name="subject"
                required
                defaultValue=""
                aria-invalid={message !== null}
                aria-describedby={message ? 'subject-error' : undefined}
                className="border-border bg-background focus-visible:outline-ring min-h-12 w-full rounded-lg border px-3 focus-visible:outline-3"
            >
                <option value="" disabled>
                    Pilih mata pelajaran
                </option>
                {Object.entries(subjects).map(([value, { label }]) => (
                    <option key={value} value={value}>
                        {label}
                    </option>
                ))}
            </select>
            <FieldError id="subject-error" message={message} />
        </div>
    );
}

function UploadDialog({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const upload = useUploadMaterial();
    const navigate = useNavigate();
    const titleId = useId();
    const [title, setTitle] = useState('');
    const rightsError = fieldErrorText(upload.error, 'rights');
    const close = (dialog?: HTMLDialogElement) => {
        if (upload.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        onClose();
    };
    return (
        <Dialog
            open={open}
            onClose={close}
            onCancel={(event) => {
                if (upload.isPending) event.preventDefault();
            }}
            aria-labelledby={titleId}
            className="max-h-[calc(100dvh-2rem)] max-w-xl flex-col p-0 open:flex"
        >
            <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const file = data.get('pdf');
                    if (!(file instanceof File)) return;
                    upload.mutate(
                        {
                            file,
                            title,
                            subject: String(data.get('subject') ?? ''),
                            grade: String(data.get('grade') ?? ''),
                            rights: data.get('rights') === 'on',
                            source: String(data.get('source') ?? '').trim(),
                            licence: String(data.get('licence') ?? ''),
                            licenceNote: String(
                                data.get('licenceNote') ?? '',
                            ).trim(),
                        },
                        {
                            onSuccess: (material) => {
                                onClose();
                                void navigate(
                                    `/teacher/materials/${material.id}`,
                                );
                            },
                        },
                    );
                }}
            >
                <div className="border-paper-edge flex items-center gap-3 border-b px-5 py-3 sm:px-6">
                    <h2
                        id={titleId}
                        className="font-display text-primary-deep flex-1 text-2xl font-semibold"
                    >
                        Unggah buku PDF
                    </h2>
                    <button
                        type="button"
                        aria-label="Tutup"
                        disabled={upload.isPending}
                        onClick={() => close()}
                        className="hover:bg-secondary focus-visible:outline-ring flex size-11 items-center justify-center rounded-xl focus-visible:outline-3 disabled:opacity-50"
                    >
                        <CloseIcon />
                    </button>
                </div>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                    <PdfDrop
                        error={upload.error}
                        onFile={(file) => {
                            if (file && title === '')
                                setTitle(file.name.replace(/\.pdf$/i, ''));
                        }}
                    />
                    <FormField
                        name="title"
                        label="Judul materi"
                        required
                        maxLength={120}
                        value={title}
                        onChange={(event) =>
                            setTitle(event.currentTarget.value)
                        }
                        error={upload.error}
                    />
                    <SubjectSelect error={upload.error} />
                    <GradePicker error={upload.error} />
                    <div className="bg-student-surface border-paper-edge space-y-2 rounded-2xl border p-4">
                        <label className="flex min-h-11 items-center gap-3">
                            <input
                                type="checkbox"
                                name="rights"
                                required
                                aria-invalid={rightsError !== null}
                                aria-describedby={
                                    rightsError ? 'rights-error' : undefined
                                }
                                className="accent-primary focus-visible:outline-ring size-5 shrink-0 focus-visible:outline-3 focus-visible:outline-offset-2"
                            />
                            <span className="font-medium">
                                Saya berhak memakai materi ini untuk mengajar.
                            </span>
                        </label>
                        <FieldError id="rights-error" message={rightsError} />
                    </div>
                    <details className="group border-paper-edge rounded-2xl border">
                        <summary className="focus-visible:outline-ring flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-4 font-semibold focus-visible:outline-3 [&::-webkit-details-marker]:hidden">
                            <span
                                aria-hidden="true"
                                className="text-primary transition-transform group-open:rotate-90"
                            >
                                ▸
                            </span>
                            <span className="flex-1">Sumber dan hak pakai</span>
                            <span className="text-muted-foreground text-sm font-normal">
                                Tidak wajib
                            </span>
                        </summary>
                        <div className="space-y-4 px-4 pb-4">
                            <p className="text-muted-foreground text-sm">
                                Bisa diisi atau diubah nanti di halaman materi.
                            </p>
                            <LicenceFields error={upload.error} />
                        </div>
                    </details>
                    <RequestError error={upload.error} />
                </div>
                <div className="border-paper-edge flex justify-end gap-3 border-t px-5 py-4 sm:px-6">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={upload.isPending}
                        onClick={() => close()}
                    >
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        className="flex-1 px-4 sm:flex-none"
                        disabled={upload.isPending}
                    >
                        {upload.isPending
                            ? 'Mengunggah…'
                            : 'Unggah dan baca PDF'}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}

export function UploadButton() {
    const [open, setOpen] = useState(false);
    const [round, setRound] = useState(0);
    return (
        <>
            <Button
                className="gap-2"
                onClick={() => {
                    setRound((value) => value + 1);
                    setOpen(true);
                }}
            >
                <UploadIcon className="size-5" />
                Unggah buku PDF
            </Button>
            <UploadDialog
                key={round}
                open={open}
                onClose={() => setOpen(false)}
            />
        </>
    );
}

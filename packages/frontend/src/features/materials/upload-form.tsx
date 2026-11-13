import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LicenceFields } from './licence-fields';
import { PdfField, pdfLimits } from './pdf-field';
import { useUploadMaterial } from './queries';
import { subjects } from '../assignments/subject-art';
import { FormField, fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

const grades = [1, 2, 3, 4, 5, 6];

function Choice({
    name,
    label,
    placeholder,
    options,
    error,
}: {
    name: string;
    label: string;
    placeholder: string;
    options: { value: string; label: string }[];
    error: unknown;
}) {
    const message = fieldErrorText(error, name);
    return (
        <div className="space-y-2">
            <label htmlFor={name} className="block font-medium">
                {label}
            </label>
            <select
                id={name}
                name={name}
                required
                defaultValue=""
                aria-invalid={message !== null}
                aria-describedby={message ? `${name}-error` : undefined}
                className="border-border bg-background focus-visible:outline-ring min-h-12 w-full rounded-lg border px-3 focus-visible:outline-3"
            >
                <option value="" disabled>
                    {placeholder}
                </option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {message && (
                <p id={`${name}-error`} className="text-destructive">
                    {message}
                </p>
            )}
        </div>
    );
}

export function UploadForm() {
    const upload = useUploadMaterial();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const rightsError = fieldErrorText(upload.error, 'rights');
    return (
        <Card>
            <form
                className="space-y-4"
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
                                void navigate(
                                    `/teacher/materials/${material.id}`,
                                );
                            },
                        },
                    );
                }}
            >
                <div>
                    <h2 className="text-lg font-semibold">Unggah PDF</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {pdfLimits}
                    </p>
                </div>
                <PdfField
                    error={upload.error}
                    onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
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
                    onChange={(event) => setTitle(event.currentTarget.value)}
                    error={upload.error}
                />
                <Choice
                    name="subject"
                    label="Mata pelajaran"
                    placeholder="Pilih mata pelajaran"
                    options={Object.entries(subjects).map(
                        ([value, { label }]) => ({ value, label }),
                    )}
                    error={upload.error}
                />
                <Choice
                    name="grade"
                    label="Kelas"
                    placeholder="Pilih kelas"
                    options={grades.map((grade) => ({
                        value: String(grade),
                        label: `Kelas ${grade}`,
                    }))}
                    error={upload.error}
                />
                <div className="space-y-2">
                    <label className="flex min-h-11 items-start gap-3">
                        <input
                            type="checkbox"
                            name="rights"
                            required
                            aria-invalid={rightsError !== null}
                            aria-describedby={
                                rightsError ? 'rights-error' : undefined
                            }
                            className="accent-primary focus-visible:outline-ring mt-0.5 size-5 shrink-0 focus-visible:outline-3 focus-visible:outline-offset-2"
                        />
                        <span>
                            Saya berhak memakai materi ini untuk mengajar.
                        </span>
                    </label>
                    {rightsError && (
                        <p id="rights-error" className="text-destructive">
                            {rightsError}
                        </p>
                    )}
                </div>
                <div className="border-paper-edge border-t pt-4">
                    <fieldset
                        className="space-y-4"
                        aria-describedby="licence-hint"
                    >
                        <legend className="mb-1 font-semibold">
                            Sumber dan hak pakai
                        </legend>
                        <p
                            id="licence-hint"
                            className="text-muted-foreground text-sm"
                        >
                            Tidak wajib. Bisa diisi atau diubah nanti di halaman
                            materi.
                        </p>
                        <LicenceFields error={upload.error} />
                    </fieldset>
                </div>
                <RequestError error={upload.error} />
                <Button type="submit" disabled={upload.isPending}>
                    {upload.isPending ? 'Mengunggah…' : 'Unggah dan baca PDF'}
                </Button>
            </form>
        </Card>
    );
}

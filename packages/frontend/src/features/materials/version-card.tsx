import { useRef, useState, type FormEvent } from 'react';
import { MaterialChangeDialog } from './material-change-dialog';
import { PdfField, pdfLimits } from './pdf-field';
import { useUploadVersion, type MaterialDetail } from './queries';
import { fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ApiError } from '../../lib/api';
import { focusHeading } from '../studio/studio-labels';

const day = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

export function VersionCard({ material }: { material: MaterialDetail }) {
    const upload = useUploadVersion(material.id);
    const [target, setTarget] = useState<number | null>(null);
    const [asking, setAsking] = useState(false);
    const [message, setMessage] = useState({ text: '', count: 0 });
    const heading = useRef<HTMLHeadingElement>(null);
    const pdfError = fieldErrorText(upload.error, 'pdf');
    const archived =
        upload.error instanceof ApiError &&
        upload.error.body.name === 'MATERIAL_ARCHIVED';

    const say = (text: string) =>
        setMessage((previous) => ({ text, count: previous.count + 1 }));
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (upload.isPending) return;
        const form = event.currentTarget;
        const file = new FormData(form).get('pdf');
        if (!(file instanceof File)) return;
        upload.mutate(file, {
            onSuccess: ({ version }) => {
                form.reset();
                form.closest('details')?.removeAttribute('open');
                say(`Versi ${version} diunggah dan aktif.`);
                heading.current?.focus();
            },
        });
    };

    return (
        <Card>
            <section aria-labelledby="versions-title">
                <h2
                    id="versions-title"
                    ref={heading}
                    tabIndex={-1}
                    className={`text-lg font-semibold ${focusHeading}`}
                >
                    Versi
                </h2>
                <p
                    role="status"
                    className="text-primary-deep mt-2 font-medium empty:mt-0"
                >
                    {message.text !== '' && (
                        <span key={message.count}>{message.text}</span>
                    )}
                </p>
                <ul className="divide-paper-edge divide-y">
                    {material.versions.map((item) => {
                        const active = item.version === material.version;
                        const labelId = `version-${item.version}`;
                        return (
                            <li
                                key={item.version}
                                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                            >
                                <div className="min-w-0 space-y-1">
                                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span
                                            id={labelId}
                                            className="font-semibold"
                                        >
                                            Versi {item.version}
                                        </span>
                                        {active && (
                                            <span className="bg-secondary text-primary-deep rounded-md px-2 py-0.5 text-sm font-semibold">
                                                Aktif
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-muted-foreground text-sm tabular-nums">
                                        {day.format(new Date(item.createdAt))} ·{' '}
                                        {item.pageCount} halaman,{' '}
                                        {item.readablePages} terbaca ·{' '}
                                        {item.chapters} bab
                                    </p>
                                </div>
                                {!active && (
                                    <Button
                                        variant="outline"
                                        aria-describedby={labelId}
                                        onClick={() => {
                                            setTarget(item.version);
                                            setAsking(true);
                                        }}
                                    >
                                        Kembali ke versi ini
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {!material.archived && (
                    <details className="border-paper-edge space-y-4 border-t pt-3">
                        <summary className="focus-visible:outline-ring w-fit cursor-pointer list-none rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 [&::-webkit-details-marker]:hidden">
                            <span
                                className={buttonVariants({
                                    variant: 'outline',
                                })}
                            >
                                Unggah versi baru
                            </span>
                        </summary>
                        <form className="space-y-4" onSubmit={submit}>
                            <div>
                                <p>
                                    Bab dan misi yang sudah ada tetap memakai
                                    versi lamanya.
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    {pdfLimits}
                                </p>
                            </div>
                            <PdfField error={upload.error} />
                            {archived ? (
                                <Alert tone="attention" role="alert">
                                    Materi ini diarsipkan. Aktifkan lagi untuk
                                    mengunggah versi baru.
                                </Alert>
                            ) : (
                                !pdfError && (
                                    <RequestError error={upload.error} />
                                )
                            )}
                            <Button
                                type="submit"
                                aria-disabled={upload.isPending}
                                className="aria-disabled:opacity-60"
                            >
                                {upload.isPending ? 'Mengunggah…' : 'Unggah'}
                            </Button>
                        </form>
                    </details>
                )}
            </section>
            {target !== null && (
                <MaterialChangeDialog
                    key={target}
                    materialId={material.id}
                    title={`Kembali ke versi ${target}?`}
                    note="Bab baru akan memakai halaman versi ini. Bab dan misi yang sudah ada tidak berubah."
                    confirm={`Kembali ke versi ${target}`}
                    pending="Mengganti versi…"
                    change={{ version: target }}
                    open={asking}
                    focusAfter={heading}
                    onClose={() => setAsking(false)}
                    onChanged={({ version }) => {
                        setAsking(false);
                        say(`Versi ${version} aktif lagi.`);
                    }}
                />
            )}
        </Card>
    );
}

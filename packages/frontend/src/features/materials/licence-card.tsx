import { useRef, useState, type FormEvent } from 'react';
import { LicenceFields, licenceLabels, licenceOf } from './licence-fields';
import { useUpdateMaterial, type MaterialDetail } from './queries';
import { fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

const fields = ['source', 'licence', 'licenceNote'];

export function LicenceCard({ material }: { material: MaterialDetail }) {
    const save = useUpdateMaterial(material.id);
    const [editing, setEditing] = useState(false);
    const [saved, setSaved] = useState(false);
    const toggle = useRef<HTMLButtonElement>(null);
    const own = !material.prepared;
    const rows = [
        { label: 'Sumber', value: material.source },
        {
            label: 'Jenis hak',
            value: material.licence && licenceLabels[material.licence],
        },
        { label: 'Catatan hak pakai', value: material.licenceNote },
    ].filter(({ value }) => value);
    const marked = fields.some((name) => fieldErrorText(save.error, name));

    if (!own && rows.length === 0) return null;

    const close = () => {
        setEditing(false);
        save.reset();
        toggle.current?.focus();
    };
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (save.isPending) return;
        const data = new FormData(event.currentTarget);
        save.mutate(
            {
                source: String(data.get('source') ?? ''),
                licence: licenceOf(data.get('licence')),
                licenceNote: String(data.get('licenceNote') ?? ''),
            },
            {
                onSuccess: () => {
                    setSaved(true);
                    close();
                },
            },
        );
    };

    return (
        <Card>
            <section aria-labelledby="licence-title">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <h2
                        id="licence-title"
                        className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
                    >
                        Sumber dan hak pakai
                    </h2>
                    {own && (
                        <Button
                            ref={toggle}
                            variant="outline"
                            aria-expanded={editing}
                            onClick={() => {
                                if (save.isPending) return;
                                if (editing) return close();
                                setSaved(false);
                                setEditing(true);
                            }}
                        >
                            Ubah
                            <span className="sr-only">
                                {' '}
                                sumber dan hak pakai
                            </span>
                        </Button>
                    )}
                </div>
                <p
                    role="status"
                    className="text-primary-deep mt-2 font-medium empty:mt-0"
                >
                    {saved && <span>Sumber dan hak pakai tersimpan.</span>}
                </p>
                {editing ? (
                    <form className="mt-3 space-y-4" onSubmit={submit}>
                        <LicenceFields values={material} error={save.error} />
                        {!marked && <RequestError error={save.error} />}
                        <div className="flex flex-wrap gap-3">
                            <Button
                                type="submit"
                                aria-disabled={save.isPending}
                                className="aria-disabled:opacity-60"
                            >
                                {save.isPending ? 'Menyimpan…' : 'Simpan'}
                            </Button>
                            <Button
                                variant="outline"
                                disabled={save.isPending}
                                onClick={close}
                            >
                                Batal
                            </Button>
                        </div>
                    </form>
                ) : rows.length === 0 ? (
                    <p className="mt-3">Belum diisi.</p>
                ) : (
                    <dl className="mt-3 space-y-2">
                        {rows.map(({ label, value }) => (
                            <div key={label}>
                                <dt className="text-muted-foreground text-sm">
                                    {label}
                                </dt>
                                <dd className="break-words whitespace-pre-line">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </section>
        </Card>
    );
}

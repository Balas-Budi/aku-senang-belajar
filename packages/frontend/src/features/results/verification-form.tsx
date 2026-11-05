import { useState, type ReactNode } from 'react';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { inputVariants } from '../../components/ui/input';
import { cn } from '../../lib/cn';
import { type Assessment, useVerify, type VerificationInput } from './queries';
import { statusLabels } from './status';

const decisions = ['agree', 'change', 'unsure'] as const;
const targets = ['visible', 'developing', 'not_observed'] as const;

function Choice({
    name,
    value,
    label,
    hint,
    onChange,
}: {
    name: string;
    value: string;
    label: string;
    hint?: ReactNode;
    onChange?: () => void;
}) {
    return (
        <label className="border-border bg-background has-[:checked]:border-primary has-[:checked]:bg-secondary flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
                type="radio"
                name={name}
                value={value}
                required
                onChange={onChange}
                className="accent-primary focus-visible:outline-ring mt-1 size-5 shrink-0 focus-visible:outline-3 focus-visible:outline-offset-2"
            />
            <span>
                <span className="block font-semibold">{label}</span>
                {hint && (
                    <span className="text-muted-foreground block text-sm">
                        {hint}
                    </span>
                )}
            </span>
        </label>
    );
}

export function VerificationForm({
    classId,
    assignmentId,
    assessment,
    code,
}: {
    classId: number;
    assignmentId: number;
    assessment: Assessment;
    code: string;
}) {
    const verify = useVerify(classId, assignmentId);
    const [decision, setDecision] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const noteId = `catatan-${code}`;

    return (
        <form
            className="bg-muted space-y-4 rounded-lg p-4"
            onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = new FormData(form);
                const note = String(values.get('note') ?? '');
                const chosen = decisions.find(
                    (item) => item === values.get('decision'),
                );
                const status = targets.find(
                    (item) => item === values.get('status'),
                );
                const input: VerificationInput | null =
                    chosen === 'change'
                        ? status
                            ? { decision: chosen, status, note }
                            : null
                        : chosen
                          ? { decision: chosen, note }
                          : null;

                if (!input) return;

                setSaved(false);
                verify.mutate(
                    { ...input, assessmentId: assessment.id },
                    {
                        onSuccess: () => {
                            form.reset();
                            setDecision(null);
                            setSaved(true);
                        },
                    },
                );
            }}
        >
            <fieldset className="space-y-2">
                <legend className="mb-2 text-lg font-semibold">
                    Keputusan Anda untuk {code}
                </legend>
                {assessment.status !== 'needs_verification' && (
                    <Choice
                        name="decision"
                        value="agree"
                        label="Setuju"
                        hint={`Status tetap ${statusLabels[assessment.status]}.`}
                        onChange={() => setDecision('agree')}
                    />
                )}
                <Choice
                    name="decision"
                    value="change"
                    label="Ubah"
                    hint="Pilih status lain, misalnya setelah bertanya langsung."
                    onChange={() => setDecision('change')}
                />
                <Choice
                    name="decision"
                    value="unsure"
                    label="Belum yakin"
                    hint={`Tampil sebagai ${statusLabels.needs_verification} sampai Anda memutuskan.`}
                    onChange={() => setDecision('unsure')}
                />
            </fieldset>
            {decision === 'change' && (
                <fieldset className="space-y-2">
                    <legend className="mb-2 font-semibold">Status baru</legend>
                    {targets
                        .filter((status) => status !== assessment.status)
                        .map((status) => (
                            <Choice
                                key={status}
                                name="status"
                                value={status}
                                label={statusLabels[status]}
                            />
                        ))}
                </fieldset>
            )}
            <div className="space-y-2">
                <label htmlFor={noteId} className="block font-medium">
                    Catatan (opsional)
                </label>
                <textarea
                    id={noteId}
                    name="note"
                    rows={3}
                    maxLength={500}
                    className={cn(inputVariants(), 'min-h-24')}
                />
            </div>
            <RequestError error={verify.error} />
            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={verify.isPending}>
                    {verify.isPending ? 'Menyimpan…' : 'Simpan keputusan'}
                </Button>
                <p role="status">{saved ? 'Keputusan tersimpan.' : ''}</p>
            </div>
        </form>
    );
}

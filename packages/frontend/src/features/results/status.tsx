import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
import type { Decision, Shown, UnderstandingStatus } from './queries';

export const statusLabels: Record<UnderstandingStatus, string> = {
    visible: 'Terlihat',
    developing: 'Berkembang',
    needs_verification: 'Perlu verifikasi',
    not_observed: 'Belum teramati',
};

const statusMeanings: Record<UnderstandingStatus, string> = {
    visible: 'Jawaban menunjukkan pemahaman sesuai target.',
    developing: 'Paham sebagian, atau benar setelah bantuan.',
    needs_verification:
        'Jawaban saling bertentangan atau kurang jelas. Tanyakan langsung kepada siswa.',
    not_observed: 'Belum ada cukup jawaban untuk menilai.',
};

export const decisionLabels: Record<Decision, string> = {
    agree: 'Diverifikasi guru',
    change: 'Diubah guru',
    unsure: 'Guru belum yakin',
};

const chipVariants = cva(
    'inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-semibold whitespace-nowrap',
    {
        variants: {
            status: {
                visible:
                    'border-status-visible bg-status-visible text-primary-foreground',
                developing:
                    'border-status-developing bg-status-developing-soft text-status-developing',
                needs_verification:
                    'border-status-verify bg-background text-status-verify border-2',
                not_observed:
                    'border-muted-foreground bg-background text-muted-foreground border-dashed',
            },
        },
    },
);

export function StatusChip({
    status,
    className,
    ...props
}: ComponentProps<'span'> & { status: UnderstandingStatus }) {
    return (
        <span className={cn(chipVariants({ status }), className)} {...props}>
            {statusLabels[status]}
        </span>
    );
}

export function reviewLabel(decision: Decision | null) {
    return decision === null ? 'Saran AI' : decisionLabels[decision];
}

export function ShownStatus({ shown }: { shown: Shown }) {
    return (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusChip status={shown.status} />
            <span
                className={cn(
                    'text-sm',
                    shown.decision === null && 'text-ai-suggestion font-medium',
                )}
            >
                {reviewLabel(shown.decision)}
            </span>
        </span>
    );
}

export function StatusLegend() {
    return (
        <details className="border-border rounded-lg border px-4 py-2">
            <summary className="focus-visible:outline-ring cursor-pointer py-2 font-semibold focus-visible:outline-3">
                Arti label
            </summary>
            <dl className="mt-2 grid gap-4 pb-2 sm:grid-cols-2">
                {(Object.keys(statusLabels) as UnderstandingStatus[]).map(
                    (status) => (
                        <div key={status} className="space-y-1">
                            <dt>
                                <StatusChip status={status} />
                            </dt>
                            <dd className="text-muted-foreground text-sm">
                                {statusMeanings[status]}
                            </dd>
                        </div>
                    ),
                )}
            </dl>
            <p className="pb-2 text-sm">
                <span className="text-ai-suggestion font-medium">Saran AI</span>{' '}
                berarti status belum diperiksa guru. Setelah Anda memutuskan,
                labelnya menjadi {decisionLabels.agree}, {decisionLabels.change}
                , atau {decisionLabels.unsure}.
            </p>
        </details>
    );
}

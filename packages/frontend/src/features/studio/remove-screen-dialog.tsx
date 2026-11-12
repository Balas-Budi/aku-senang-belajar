import { useId } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { ApiError } from '../../lib/api';
import {
    useRemoveBlock,
    type StudioBlock,
    type StudioSession,
} from './queries';
import { StudioError } from './studio-error';
import { joined } from './studio-labels';

function refusalOf(
    error: Error | null,
    session: StudioSession,
    block: StudioBlock,
) {
    if (!(error instanceof ApiError) || error.status !== 409) return null;
    if (error.body.name === 'KEEP_STRUCTURE')
        return 'Misi perlu setidaknya dua layar cerita dan satu cek pemahaman.';
    if (error.body.name !== 'COMPETENCY_UNTESTED') return null;
    const untested = block.competencies.filter(
        (code) =>
            session.competencies.some((taught) => taught.code === code) &&
            !session.blocks.some(
                (other) =>
                    other.id !== block.id &&
                    (other.kind === 'check' || other.kind === 'challenge') &&
                    other.competencies.includes(code),
            ),
    );
    return `Kompetensi ${untested.length > 0 ? joined(untested) : 'sesi ini'} tidak lagi diuji oleh cek atau tantangan.`;
}

export function RemoveScreenDialog({
    session,
    block,
    open,
    onClose,
    onRemoved,
}: {
    session: StudioSession;
    block: StudioBlock;
    open: boolean;
    onClose: () => void;
    onRemoved: (next: StudioSession) => void;
}) {
    const remove = useRemoveBlock(session.id);
    const titleId = useId();
    const descriptionId = useId();
    const refusal = refusalOf(remove.error, session, block);
    const close = (dialog?: HTMLDialogElement) => {
        if (remove.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        remove.reset();
        onClose();
    };
    return (
        <Dialog
            open={open}
            onClose={close}
            onCancel={(event) => {
                if (remove.isPending) event.preventDefault();
            }}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <h2 id={titleId} className="text-primary-deep text-xl font-bold">
                Hapus layar ini?
            </h2>
            <p
                id={descriptionId}
                className="text-muted-foreground mt-2 leading-relaxed"
            >
                Layar ini hilang dari draf. Tema cerita perlu dibaca ulang.
            </p>
            <div className="mt-5 space-y-4">
                {refusal ? (
                    <Alert tone="attention" role="alert">
                        {refusal}
                    </Alert>
                ) : (
                    <StudioError error={remove.error} />
                )}
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        autoFocus
                        disabled={remove.isPending}
                        onClick={() => close()}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        aria-disabled={remove.isPending}
                        className="aria-disabled:opacity-60"
                        onClick={() => {
                            if (remove.isPending) return;
                            remove.mutate(block.id, { onSuccess: onRemoved });
                        }}
                    >
                        {remove.isPending ? 'Menghapus…' : 'Hapus layar'}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}

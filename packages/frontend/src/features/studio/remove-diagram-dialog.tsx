import { useId } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { DiagramPicture } from '../learning-sessions/diagram';
import {
    withoutDiagram,
    type DiagramField,
    type EditableBlock,
} from './block-fields';
import { useEditBlock } from './queries';
import { StudioError } from './studio-error';

export function RemoveDiagramDialog({
    sessionId,
    block,
    field,
    open,
    onClose,
    onDone,
}: {
    sessionId: number;
    block: EditableBlock;
    field: DiagramField;
    open: boolean;
    onClose: () => void;
    onDone: () => void;
}) {
    const edit = useEditBlock(sessionId);
    const titleId = useId();
    const descriptionId = useId();
    const close = (dialog?: HTMLDialogElement) => {
        if (edit.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        edit.reset();
        onClose();
    };
    return (
        <Dialog
            open={open}
            onClose={close}
            onCancel={(event) => {
                if (edit.isPending) event.preventDefault();
            }}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <h2 id={titleId} className="text-primary-deep text-xl font-bold">
                Hapus {field.name.toLowerCase()} di layar {block.position}?
            </h2>
            <DiagramPicture
                diagram={field.diagram}
                aria-hidden
                className="mx-auto mt-4 max-w-40"
            />
            <p
                id={descriptionId}
                className="text-muted-foreground mt-4 leading-relaxed"
            >
                Siswa tidak akan melihat gambar ini, dan teks layarnya tetap.
                Gambar yang dihapus tidak bisa dikembalikan; minta revisi bila
                Anda perlu gambar lain.
            </p>
            <div className="mt-5 space-y-4">
                <StudioError error={edit.error} />
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        disabled={edit.isPending}
                        onClick={() => close()}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        aria-disabled={edit.isPending}
                        className="aria-disabled:opacity-60"
                        onClick={() => {
                            if (edit.isPending) return;
                            edit.mutate(
                                {
                                    blockId: block.id,
                                    content: withoutDiagram(
                                        block.content,
                                        field.path,
                                    ),
                                },
                                { onSuccess: onDone },
                            );
                        }}
                    >
                        {edit.isPending ? 'Menghapus…' : 'Hapus gambar'}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}

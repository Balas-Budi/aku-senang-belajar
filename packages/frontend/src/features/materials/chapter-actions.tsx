import { useEffect, useId, useRef, useState } from 'react';
import {
    useDeleteModule,
    useRenameModule,
    type MaterialDetail,
} from './queries';
import { FormField } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';

type Module = MaterialDetail['modules'][number];

export function ChapterActions({
    materialId,
    module,
    onDone,
}: {
    materialId: number;
    module: Module;
    onDone: (text: string, removed?: boolean) => void;
}) {
    const rename = useRenameModule(materialId, module.id);
    const remove = useDeleteModule(materialId, module.id);
    const [editing, setEditing] = useState(false);
    const [asking, setAsking] = useState(false);
    const editButton = useRef<HTMLButtonElement>(null);
    const cancel = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const noteId = useId();
    const fieldId = `chapter-title-${module.id}`;

    useEffect(() => {
        if (asking) cancel.current?.focus();
    }, [asking]);

    const closeDialog = (dialog?: HTMLDialogElement) => {
        if (remove.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        remove.reset();
        setAsking(false);
    };

    if (editing)
        return (
            <form
                className="space-y-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    const title = new FormData(event.currentTarget).get(
                        'title',
                    );
                    if (typeof title !== 'string') return;
                    rename.mutate(title, {
                        onSuccess: () => {
                            setEditing(false);
                            onDone('Judul bab tersimpan.');
                            requestAnimationFrame(() =>
                                editButton.current?.focus(),
                            );
                        },
                    });
                }}
            >
                <FormField
                    id={fieldId}
                    name="title"
                    label="Judul bab"
                    required
                    maxLength={120}
                    defaultValue={module.title}
                    error={rename.error}
                    autoFocus
                />
                <RequestError error={rename.error} />
                <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={rename.isPending}>
                        {rename.isPending ? 'Menyimpan…' : 'Simpan judul'}
                    </Button>
                    <Button
                        variant="outline"
                        disabled={rename.isPending}
                        onClick={() => {
                            rename.reset();
                            setEditing(false);
                            requestAnimationFrame(() =>
                                editButton.current?.focus(),
                            );
                        }}
                    >
                        Batal
                    </Button>
                </div>
            </form>
        );

    return (
        <div className="flex flex-wrap gap-2">
            <Button
                ref={editButton}
                variant="outline"
                className="min-h-11 px-4 text-sm"
                onClick={() => setEditing(true)}
            >
                Ubah judul
            </Button>
            {module.sessions.length === 0 && (
                <>
                    <Button
                        variant="outline"
                        className="min-h-11 px-4 text-sm"
                        onClick={() => setAsking(true)}
                    >
                        Hapus bab
                    </Button>
                    <Dialog
                        open={asking}
                        onClose={closeDialog}
                        onCancel={(event) => {
                            if (remove.isPending) event.preventDefault();
                        }}
                        aria-labelledby={titleId}
                        aria-describedby={noteId}
                    >
                        <h2
                            id={titleId}
                            className="text-primary-deep text-xl font-bold"
                        >
                            Hapus bab “{module.title}”?
                        </h2>
                        <p
                            id={noteId}
                            className="text-muted-foreground mt-2 leading-relaxed"
                        >
                            Kompetensi bab ini ikut terhapus. Halamannya tetap
                            ada, dan bisa dijadikan bab lagi lewat “Tambah bab
                            sendiri”.
                        </p>
                        <div className="mt-5 space-y-4">
                            <RequestError error={remove.error} />
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    ref={cancel}
                                    variant="outline"
                                    disabled={remove.isPending}
                                    onClick={() => closeDialog()}
                                >
                                    Batal
                                </Button>
                                <Button
                                    variant="destructive"
                                    aria-disabled={remove.isPending}
                                    className="aria-disabled:opacity-60"
                                    onClick={() => {
                                        if (remove.isPending) return;
                                        remove.mutate(undefined, {
                                            onSuccess: () => {
                                                setAsking(false);
                                                onDone(
                                                    `Bab “${module.title}” dihapus.`,
                                                    true,
                                                );
                                            },
                                        });
                                    }}
                                >
                                    {remove.isPending
                                        ? 'Menghapus…'
                                        : 'Hapus bab'}
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </>
            )}
        </div>
    );
}

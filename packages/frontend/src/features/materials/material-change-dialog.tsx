import { useEffect, useId, useRef, type RefObject } from 'react';
import {
    useUpdateMaterial,
    type MaterialChange,
    type MaterialDetail,
} from './queries';
import { fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';

export function MaterialChangeDialog({
    materialId,
    title,
    note,
    confirm,
    pending,
    change,
    open,
    focusAfter,
    onClose,
    onChanged,
}: {
    materialId: number;
    title: string;
    note: string;
    confirm: string;
    pending: string;
    change: MaterialChange;
    open: boolean;
    focusAfter: RefObject<HTMLElement | null>;
    onClose: () => void;
    onChanged: (material: MaterialDetail) => void;
}) {
    const update = useUpdateMaterial(materialId);
    const cancel = useRef<HTMLButtonElement>(null);
    const changed = useRef(false);
    const titleId = useId();
    const noteId = useId();
    const versionError = fieldErrorText(update.error, 'version');

    useEffect(() => {
        if (open) cancel.current?.focus();
    }, [open]);

    const close = (dialog?: HTMLDialogElement) => {
        if (update.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        update.reset();
        onClose();
        if (changed.current) {
            changed.current = false;
            focusAfter.current?.focus();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            onCancel={(event) => {
                if (update.isPending) event.preventDefault();
            }}
            aria-labelledby={titleId}
            aria-describedby={noteId}
        >
            <h2 id={titleId} className="text-primary-deep text-xl font-bold">
                {title}
            </h2>
            <p
                id={noteId}
                className="text-muted-foreground mt-2 leading-relaxed"
            >
                {note}
            </p>
            <div className="mt-5 space-y-4">
                {versionError ? (
                    <Alert tone="attention" role="alert">
                        {versionError}
                    </Alert>
                ) : (
                    <RequestError error={update.error} />
                )}
                <div className="flex flex-wrap gap-3">
                    <Button
                        ref={cancel}
                        variant="outline"
                        disabled={update.isPending}
                        onClick={() => close()}
                    >
                        Batal
                    </Button>
                    <Button
                        aria-disabled={update.isPending}
                        className="aria-disabled:opacity-60"
                        onClick={() => {
                            if (update.isPending) return;
                            update.mutate(change, {
                                onSuccess: (material) => {
                                    changed.current = true;
                                    onChanged(material);
                                },
                            });
                        }}
                    >
                        {update.isPending ? pending : confirm}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}

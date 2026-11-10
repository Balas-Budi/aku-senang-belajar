import { useEffect, useRef, type ComponentProps } from 'react';
import { cn } from '../../lib/cn';
export function Dialog({
    open,
    onClose,
    className,
    children,
    ...props
}: Omit<ComponentProps<'dialog'>, 'open' | 'onClose'> & {
    open: boolean;
    onClose: (dialog: HTMLDialogElement) => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);
    return (
        <dialog
            ref={ref}
            onClose={(event) => onClose(event.currentTarget)}
            onClick={(event) => {
                if (event.target === event.currentTarget)
                    onClose(event.currentTarget);
            }}
            className={cn(
                'bg-background text-foreground backdrop:bg-primary-deep/50 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-6 shadow-xl',
                className,
            )}
            {...props}
        >
            {children}
        </dialog>
    );
}

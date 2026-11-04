import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
export function LogoutDialog({
    open,
    onClose,
    onConfirm,
    pending,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    pending: boolean;
}) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            onCancel={(event) => {
                if (pending) event.preventDefault();
            }}
        >
            <h2
                id="logout-title"
                className="text-primary-deep text-2xl font-extrabold"
            >
                Mau keluar dulu?
            </h2>
            <p
                id="logout-description"
                className="text-muted-foreground mt-3 text-base leading-relaxed"
            >
                Kamu bisa masuk lagi kapan saja untuk melanjutkan belajar.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                    variant="outline"
                    autoFocus
                    disabled={pending}
                    onClick={onClose}
                >
                    Batal
                </Button>
                <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={onConfirm}
                >
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 40 40"
                        fill="none"
                        className="crying-face size-8 shrink-0"
                    >
                        <circle
                            cx="20"
                            cy="20"
                            r="18"
                            fill="var(--color-student-accent-soft)"
                        />
                        <g
                            stroke="var(--color-primary-deep)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <path d="m10 13 5-2m10 0 5 2M11 18l4-1m10 0 4 1M15 29q5-7 10 0" />
                        </g>
                        <g fill="var(--color-primary)">
                            <path
                                className="crying-tear"
                                d="M12 18q-7 9 0 9t0-9Z"
                            />
                            <path
                                className="crying-tear crying-tear-right"
                                d="M28 18q-7 9 0 9t0-9Z"
                            />
                        </g>
                    </svg>
                    {pending ? 'Sedang keluar…' : 'Ya, keluar'}
                </Button>
            </div>
        </Dialog>
    );
}

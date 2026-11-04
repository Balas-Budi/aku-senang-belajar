import { JalakBali } from '../../components/jalak-bali';
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
            className="font-rounded border-paper-edge border-2 text-center"
        >
            <JalakBali sad className="mx-auto w-28" />
            <h2
                id="logout-title"
                className="font-display text-primary-deep mt-3 text-3xl font-semibold"
            >
                Mau keluar dulu?
            </h2>
            <p
                id="logout-description"
                className="text-muted-foreground mt-2 text-lg leading-relaxed"
            >
                Kamu bisa masuk lagi kapan saja untuk melanjutkan belajar.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                    variant="outline"
                    feel="chunky"
                    autoFocus
                    disabled={pending}
                    onClick={onClose}
                >
                    Batal
                </Button>
                <Button
                    variant="destructive"
                    feel="chunky"
                    disabled={pending}
                    onClick={onConfirm}
                >
                    {pending ? 'Sedang keluar…' : 'Ya, keluar'}
                </Button>
            </div>
        </Dialog>
    );
}

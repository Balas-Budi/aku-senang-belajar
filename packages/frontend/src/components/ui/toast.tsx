import {
    createContext,
    use,
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { AlertIcon } from '../icons/alert-icon';
import { CloseIcon } from '../icons/close-icon';
const visibleMilliseconds = 6000;
type Toast = { id: number; message: string };
const ToastContext = createContext<(message: string) => void>(() => {});
export function useErrorToast() {
    return use(ToastContext);
}
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const lastId = useRef(0);
    const show = useCallback((message: string) => {
        lastId.current += 1;
        const toast = { id: lastId.current, message };
        setToasts((current) => [
            ...current.filter((item) => item.message !== message).slice(-2),
            toast,
        ]);
    }, []);
    const dismiss = useCallback(
        (id: number) =>
            setToasts((current) => current.filter((item) => item.id !== id)),
        [],
    );
    return (
        <ToastContext value={show}>
            {children}
            <div className="font-rounded pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {toasts.map((toast) => (
                    <ToastMessage
                        key={toast.id}
                        toast={toast}
                        onDismiss={dismiss}
                    />
                ))}
            </div>
        </ToastContext>
    );
}
function ToastMessage({
    toast,
    onDismiss,
}: {
    toast: Toast;
    onDismiss: (id: number) => void;
}) {
    const [paused, setPaused] = useState(false);
    const remaining = useRef(visibleMilliseconds);
    useEffect(() => {
        if (paused) return;
        const started = Date.now();
        const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
        return () => {
            clearTimeout(timer);
            remaining.current -= Date.now() - started;
        };
    }, [paused, onDismiss, toast.id]);
    return (
        <div
            role="alert"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="toast border-destructive/25 pointer-events-auto relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded-2xl border-2 bg-white py-2 pr-2 pl-4 shadow-lg"
        >
            <AlertIcon className="text-destructive mt-2.5 size-6" />
            <p className="text-foreground flex-1 py-2.5 text-base leading-snug">
                {toast.message}
            </p>
            <button
                type="button"
                aria-label="Tutup pesan"
                onClick={() => onDismiss(toast.id)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-3"
            >
                <CloseIcon />
            </button>
            <span
                aria-hidden="true"
                className="toast-timer bg-destructive absolute inset-x-0 bottom-0 h-1 origin-left motion-reduce:hidden"
                style={{ animationPlayState: paused ? 'paused' : 'running' }}
            />
        </div>
    );
}

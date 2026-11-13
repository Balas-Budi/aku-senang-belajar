import { useEffect, useState } from 'react';
import { useLocation, useNavigation } from 'react-router';
import { JalakBali } from './jalak-bali';

/** Waits a moment so fast page changes never flash the loader. */
const SHOW_AFTER_MS = 250;

/**
 * True while the router loads another page. Changes that keep the path, such
 * as switching tabs through `?bagian=`, keep the page on screen.
 */
export function usePageLoading() {
    const navigation = useNavigation();
    const location = useLocation();
    const moving =
        navigation.state === 'loading' &&
        navigation.location !== undefined &&
        navigation.location.pathname !== location.pathname;
    const [shown, setShown] = useState(false);
    useEffect(() => {
        if (!moving) {
            setShown(false);
            return;
        }
        const timer = window.setTimeout(() => setShown(true), SHOW_AFTER_MS);
        return () => window.clearTimeout(timer);
    }, [moving]);
    return shown;
}

export function PageLoading({ label = 'Memuat halaman…' }: { label?: string }) {
    return (
        <div
            role="status"
            className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-4 py-12 text-center"
        >
            <div aria-hidden="true" className="page-walk-track w-full max-w-sm">
                <div className="page-walk">
                    <div className="page-walk-step">
                        <JalakBali className="w-20" />
                    </div>
                </div>
                <div className="page-walk-ground" />
            </div>
            <p className="font-display text-primary-deep text-xl font-semibold">
                {label}
            </p>
            <p className="text-muted-foreground">
                Si Jalak sedang mengambilkan halamannya.
            </p>
        </div>
    );
}

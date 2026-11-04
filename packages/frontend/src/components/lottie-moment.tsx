import { useEffect, useRef } from 'react';
import type { AnimationItem } from 'lottie-web';
import { cn } from '../lib/cn';
export function LottieMoment({
    path,
    className,
}: {
    path: string;
    className?: string;
}) {
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const container = host.current;
        if (
            !container ||
            matchMedia('(prefers-reduced-motion: reduce)').matches
        )
            return;
        let animation: AnimationItem | undefined;
        let cancelled = false;
        void import('lottie-web/build/player/lottie_light').then(
            ({ default: lottie }) => {
                if (cancelled) return;
                const moment = lottie.loadAnimation({
                    container,
                    path,
                    renderer: 'svg',
                    loop: false,
                    autoplay: true,
                });
                moment.addEventListener('complete', () => {
                    moment.destroy();
                    animation = undefined;
                });
                animation = moment;
            },
        );
        return () => {
            cancelled = true;
            animation?.destroy();
        };
    }, [path]);
    return (
        <div
            ref={host}
            aria-hidden="true"
            className={cn('pointer-events-none', className)}
        />
    );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
export function useSpeech() {
    const [message, setMessage] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const say = useCallback((text: string, milliseconds: number) => {
        clearTimeout(timer.current);
        setMessage(text);
        timer.current = setTimeout(() => setMessage(null), milliseconds);
    }, []);
    return [message, say] as const;
}
export function SpeechBubble({
    message,
    announce = true,
    className,
}: {
    message: string | null;
    announce?: boolean;
    className?: string;
}) {
    return (
        <p
            role={announce ? 'status' : undefined}
            aria-hidden={announce ? undefined : true}
            className={
                message
                    ? cn(
                          'jalak-bubble font-display text-primary-deep border-paper-edge pointer-events-none absolute z-10 w-max max-w-48 rounded-2xl border-2 bg-white px-3 py-2 text-base leading-snug font-semibold shadow-[0_3px_0_var(--color-paper-edge)]',
                          className,
                      )
                    : 'sr-only'
            }
        >
            {message}
        </p>
    );
}

import { useEffect, useState } from 'react';

export function useMinutesLeft(endsAt: string | null) {
    const [minutes, setMinutes] = useState<number | null>(null);

    useEffect(() => {
        if (!endsAt) {
            setMinutes(null);
            return;
        }
        const read = () =>
            setMinutes(
                Math.max(
                    0,
                    Math.ceil((Date.parse(endsAt) - Date.now()) / 60_000),
                ),
            );
        read();
        const timer = setInterval(read, 5_000);
        return () => clearInterval(timer);
    }, [endsAt]);

    return minutes;
}

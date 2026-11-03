import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';
const colors = [
    'var(--color-activity-orange)',
    'var(--color-activity-blue)',
    'var(--color-activity-green)',
    'var(--color-activity-pink)',
    'var(--color-primary)',
];
const pieces = Array.from({ length: 18 }, (_, index) => {
    const angle = Math.PI * (0.08 + (0.84 * index) / 17);
    const distance = 90 + ((index * 37) % 70);
    return {
        color: colors[index % colors.length],
        x: Math.round(-Math.cos(angle) * distance * 1.6),
        y: Math.round(-Math.sin(angle) * distance),
        turn: ((index * 97) % 360) - 180,
        round: index % 3 === 0,
    };
});
export function Confetti() {
    const burst = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const animations = pieces.map(({ x, y, turn }, index) =>
            burst.current?.children.item(index)?.animate(
                [
                    {
                        transform: 'translate(-50%, 0) rotate(0deg)',
                        opacity: 1,
                    },
                    {
                        transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${turn}deg)`,
                        opacity: 1,
                        offset: 0.6,
                    },
                    {
                        transform: `translate(calc(-50% + ${x * 1.15}px), ${y + 80}px) rotate(${turn * 1.6}deg)`,
                        opacity: 0,
                    },
                ],
                {
                    duration: 1400,
                    easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)',
                    fill: 'forwards',
                },
            ),
        );
        return () => animations.forEach((animation) => animation?.cancel());
    }, []);
    return (
        <div
            ref={burst}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10"
        >
            {pieces.map((piece, index) => (
                <span
                    key={index}
                    className={cn(
                        'absolute top-0 left-1/2 h-3 w-2 rounded-sm opacity-0',
                        piece.round && 'size-2.5 rounded-full',
                    )}
                    style={{ backgroundColor: piece.color }}
                />
            ))}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
export function WelcomeStickers({ cheers }: { cheers: number }) {
    const [hopping, setHopping] = useState(false);
    useEffect(() => {
        if (!cheers) return;
        setHopping(true);
        const timer = setTimeout(() => setHopping(false), 900);
        return () => clearTimeout(timer);
    }, [cheers]);
    return (
        <div
            aria-hidden="true"
            className={cn(
                'welcome-stickers pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]',
                hopping && 'welcome-stickers--hop',
            )}
        >
            <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="var(--color-primary-deep)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sticker absolute top-[7%] right-[3%] size-8 [--tilt:10deg] sm:size-9"
            >
                <rect
                    x="7"
                    y="7"
                    width="34"
                    height="34"
                    rx="8"
                    fill="var(--color-primary)"
                />
                <path d="M17 33 24 14l7 19m-11.5-6.5h9" stroke="white" />
            </svg>
            <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="var(--color-primary-deep)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sticker absolute top-[12%] left-[44%] hidden size-10 [--tilt:-18deg] [animation-delay:-2.5s] sm:block"
            >
                <path
                    d="M10 38l3-9L32 10l6 6-19 19z"
                    fill="var(--color-activity-orange)"
                />
                <path d="M10 38l3-9 6 6z" fill="white" />
                <path
                    d="M10 38l1.2-4 2.8 2.8z"
                    fill="var(--color-primary-deep)"
                />
                <path
                    d="M32 10l3-3a2.8 2.8 0 0 1 4 0l2 2a2.8 2.8 0 0 1 0 4l-3 3z"
                    fill="var(--color-activity-pink)"
                />
            </svg>
            <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="var(--color-primary-deep)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sticker absolute top-[8%] right-[29%] hidden size-11 [--tilt:-8deg] [animation-delay:-4s] lg:block"
            >
                <circle
                    cx="24"
                    cy="24"
                    r="11"
                    fill="var(--color-activity-blue)"
                />
                <path d="M19 20c2-2 4-3 7-3" stroke="white" />
                <ellipse
                    cx="24"
                    cy="25"
                    rx="20"
                    ry="6.5"
                    transform="rotate(-20 24 25)"
                />
            </svg>
            <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="var(--color-primary-deep)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sticker absolute bottom-[12%] left-[52%] hidden size-10 [--tilt:12deg] [animation-delay:-3.2s] lg:block"
            >
                <circle cx="24" cy="24" r="16" fill="white" />
                <path
                    d="M24 24V8a16 16 0 0 1 16 16z"
                    fill="var(--color-activity-pink)"
                />
                <path d="M24 8v32M8 24h32" />
            </svg>
            <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="var(--color-primary-deep)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sticker absolute right-[4%] bottom-[8%] size-8 [--tilt:-6deg] [animation-delay:-0.6s] sm:size-9"
            >
                <path d="M24 41V24M16 41h16" />
                <path
                    d="M24 28c-9 0-13-5-13-12 8 0 13 4 13 12z"
                    fill="var(--color-activity-green)"
                />
                <path
                    d="M24 24c0-8 5-12 13-12 0 7-4 12-13 12z"
                    fill="var(--color-activity-green)"
                />
            </svg>
        </div>
    );
}

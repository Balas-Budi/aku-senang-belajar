import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
export function SchoolBag({
    cheers = 0,
    className,
}: {
    cheers?: number;
    className?: string;
}) {
    const [hopping, setHopping] = useState(false);
    useEffect(() => {
        if (!cheers) return;
        setHopping(true);
        const timer = setTimeout(() => setHopping(false), 950);
        return () => clearTimeout(timer);
    }, [cheers]);
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 200 214"
            fill="none"
            stroke="var(--color-primary-deep)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
                'block overflow-visible',
                hopping && 'school-bag--hop',
                className,
            )}
        >
            <ellipse
                cx="100"
                cy="204"
                rx="64"
                ry="7"
                fill="var(--color-primary-deep)"
                opacity=".1"
                stroke="none"
            />
            <g transform="rotate(-14 52 50)">
                <rect
                    x="42"
                    y="8"
                    width="18"
                    height="70"
                    rx="3"
                    fill="var(--color-activity-green)"
                />
                <path d="M42 20h7M42 30h5M42 40h7M42 50h5" strokeWidth="3" />
            </g>
            <g transform="rotate(16 150 44)">
                <rect
                    x="141"
                    y="8"
                    width="16"
                    height="62"
                    rx="2"
                    fill="var(--color-activity-orange)"
                />
                <path
                    d="M141 8l8-16 8 16Z"
                    fill="var(--color-student-accent-soft)"
                />
                <path
                    d="M146 -2l3-6 3 6Z"
                    fill="var(--color-primary-deep)"
                    strokeWidth="2"
                />
            </g>
            <path d="M76 44C76 18 124 18 124 44" strokeWidth="12" />
            <path
                d="M76 44C76 18 124 18 124 44"
                stroke="var(--color-secondary)"
                strokeWidth="5"
            />
            <rect
                x="34"
                y="40"
                width="132"
                height="156"
                rx="38"
                fill="var(--color-primary)"
            />
            <path
                d="M34 86C34 60 54 40 80 40H120C146 40 166 60 166 86V102C142 118 58 118 34 102Z"
                fill="var(--color-secondary)"
            />
            <g fill="white">
                <rect x="64" y="100" width="16" height="22" rx="5" />
                <rect x="120" y="100" width="16" height="22" rx="5" />
            </g>
            <rect
                x="56"
                y="132"
                width="88"
                height="52"
                rx="18"
                fill="var(--color-secondary)"
            />
            <path d="M68 148h64" strokeWidth="3.5" strokeDasharray="2 7" />
            <rect
                x="124"
                y="141"
                width="10"
                height="16"
                rx="4"
                fill="var(--color-activity-orange)"
                strokeWidth="3"
            />
            <path d="M34 112h-4" strokeWidth="4" />
            <circle cx="24" cy="112" r="6" strokeWidth="3.5" />
            <path d="M24 118v10" strokeWidth="3" />
            <circle cx="24" cy="142" r="14" fill="white" strokeWidth="3.5" />
            <path
                d="M24 142V128a14 14 0 0 1 14 14z"
                fill="var(--color-activity-pink)"
                strokeWidth="3"
            />
            <path d="M24 128v28M10 142h28" strokeWidth="3" />
        </svg>
    );
}

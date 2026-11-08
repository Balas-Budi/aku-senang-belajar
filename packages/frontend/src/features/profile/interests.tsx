import type { ReactNode } from 'react';
const pink = 'var(--color-activity-pink)';
const green = 'var(--color-activity-green)';
const blue = 'var(--color-activity-blue)';
const orange = 'var(--color-activity-orange)';
const yellow = 'var(--color-jalak-beak)';
const deep = 'var(--color-primary-deep)';
export const interests = [
    {
        key: 'animals',
        label: 'Hewan',
        tint: 'bg-activity-orange/15',
        drawing: (
            <>
                <path
                    d="M10.5 22 8.5 8 20 14.5zM37.5 22 39.5 8 28 14.5z"
                    fill={orange}
                />
                <path
                    d="M11.5 18.5 10.7 12l5 3zM36.5 18.5l.8-6.5-5 3z"
                    fill={pink}
                    stroke="none"
                />
                <ellipse cx="24" cy="27" rx="15" ry="12.5" fill={orange} />
                <circle cx="18.5" cy="25.5" r="2" fill={deep} stroke="none" />
                <circle cx="29.5" cy="25.5" r="2" fill={deep} stroke="none" />
                <path d="M22 30.5h4L24 33z" fill={pink} strokeWidth="1.5" />
                <path
                    d="M24 33c0 2-1.5 3-3.5 2.5M24 33c0 2 1.5 3 3.5 2.5M13.5 30 5 28.5M13.5 33 5.5 35M34.5 30l8.5-1.5M34.5 33l8 2"
                    strokeWidth="2"
                />
            </>
        ),
    },
    {
        key: 'football',
        label: 'Sepak bola',
        tint: 'bg-activity-green/15',
        drawing: (
            <>
                <circle cx="24" cy="24" r="16" fill="white" />
                <path d="m24 17.5 6.2 4.5-2.4 7.3h-7.6l-2.4-7.3z" fill={deep} />
                <path d="M24 17.5V8.2M30.2 22l8.8-2.9M27.8 29.3l5.5 7.5M20.2 29.3l-5.5 7.5M17.8 22 9 19.1" />
            </>
        ),
    },
    {
        key: 'superheroes',
        label: 'Pahlawan super',
        tint: 'bg-activity-pink/15',
        drawing: (
            <>
                <path
                    d="M4 21.5c0-8 10-10.5 20-4.5 10-6 20-3.5 20 4.5 0 9.5-7.5 14-13.5 11-3-1.5-4.5-4.5-6.5-4.5s-3.5 3-6.5 4.5C11.5 35.5 4 31 4 21.5z"
                    fill={pink}
                />
                <path
                    d="M10.5 23c3-3.5 7.5-3.5 10.5 0-3 3-7.5 3-10.5 0zM37.5 23c-3-3.5-7.5-3.5-10.5 0 3 3 7.5 3 10.5 0z"
                    fill="white"
                />
            </>
        ),
    },
    {
        key: 'space',
        label: 'Luar angkasa',
        tint: 'bg-primary/15',
        drawing: (
            <>
                <g transform="rotate(-20 24 25)">
                    <path d="M7 25a17 5.5 0 0 1 34 0" strokeWidth="6" />
                    <path d="M7 25a17 5.5 0 0 1 34 0" stroke={yellow} />
                </g>
                <circle cx="24" cy="25" r="10" fill={blue} />
                <g transform="rotate(-20 24 25)">
                    <path d="M41 25a17 5.5 0 0 1-34 0" strokeWidth="6" />
                    <path d="M41 25a17 5.5 0 0 1-34 0" stroke={yellow} />
                </g>
                <circle cx="39" cy="9" r="2" fill={yellow} strokeWidth="1.5" />
                <circle
                    cx="9.5"
                    cy="10.5"
                    r="1.5"
                    fill={yellow}
                    strokeWidth="1.5"
                />
            </>
        ),
    },
    {
        key: 'music',
        label: 'Musik',
        tint: 'bg-activity-blue/15',
        drawing: (
            <>
                <path d="M18.5 33V14.5l18-5V28" />
                <path d="m18.5 14.5 18-5v5l-18 5z" fill={deep} />
                <ellipse
                    cx="14"
                    cy="33"
                    rx="5"
                    ry="4"
                    transform="rotate(-20 14 33)"
                    fill={pink}
                />
                <ellipse
                    cx="32"
                    cy="28"
                    rx="5"
                    ry="4"
                    transform="rotate(-20 32 28)"
                    fill={pink}
                />
            </>
        ),
    },
    {
        key: 'drawing',
        label: 'Menggambar',
        tint: 'bg-jalak-beak/30',
        drawing: (
            <>
                <path
                    d="M24 7.5C13.5 7.5 6.5 15 6.5 24.5S13 41 21.5 41c3 0 4.5-2 3.5-4.5s0-5 3-5h4.5c5.5 0 10-3.5 10-9.5C42.5 13.5 34 7.5 24 7.5z"
                    fill="white"
                />
                <circle cx="15.5" cy="20.5" r="3.2" fill={pink} />
                <circle cx="24.5" cy="15" r="3.2" fill={blue} />
                <circle cx="33.5" cy="19.5" r="3.2" fill={green} />
                <circle cx="14.5" cy="30.5" r="3.2" fill={orange} />
            </>
        ),
    },
    {
        key: 'cooking',
        label: 'Memasak',
        tint: 'bg-activity-orange/15',
        drawing: (
            <>
                <path
                    d="M17 11c-1.5-1.5 1.5-3 0-4.5M24 10c-1.5-1.5 1.5-3 0-4.5M31 11c-1.5-1.5 1.5-3 0-4.5"
                    strokeWidth="2"
                />
                <path d="M9 25H4.5M39 25h4.5" strokeWidth="3" />
                <path
                    d="M9 21h30v11a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6z"
                    fill={pink}
                />
                <path d="M7 21c0-3.5 7.5-5.5 17-5.5s17 2 17 5.5z" fill={pink} />
                <path d="M21 15.5a3 3 0 0 1 6 0" fill="white" />
            </>
        ),
    },
    {
        key: 'nature',
        label: 'Alam',
        tint: 'bg-activity-blue/15',
        drawing: (
            <>
                <circle cx="24" cy="17.5" r="5.5" fill={yellow} />
                <path d="M4 39 14 15l10 17 10-17 10 24z" fill={green} />
            </>
        ),
    },
] as const satisfies readonly {
    key: string;
    label: string;
    tint: string;
    drawing: ReactNode;
}[];
export type Interest = (typeof interests)[number]['key'];

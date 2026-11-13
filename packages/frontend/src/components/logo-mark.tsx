/** The brand mark: the jalak bali's face only. The full bird is the mascot. */
export function LogoMark({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden="true"
            viewBox="-1 -4 66 66"
            fill="none"
            stroke="var(--color-jalak-ink)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <g fill="white">
                <path d="M27 16C22 9 17 6 11 6c2 6 7 11 13 13z" />
                <path d="M31 15c-1-7 1-12 6-15 2 6 0 12-3 16z" />
                <path d="M36 17c4-6 9-8 15-7-3 5-8 9-13 10z" />
            </g>
            <path
                d="M32 15c13 0 24 9.5 24 23 0 12-10.5 21-24 21S8 50 8 38c0-13.5 11-23 24-23z"
                fill="white"
            />
            <g fill="var(--color-activity-blue)" stroke="none">
                <ellipse
                    cx="22.5"
                    cy="36"
                    rx="9"
                    ry="8"
                    transform="rotate(-14 22.5 36)"
                />
                <ellipse
                    cx="41.5"
                    cy="36"
                    rx="9"
                    ry="8"
                    transform="rotate(14 41.5 36)"
                />
            </g>
            <g fill="var(--color-jalak-ink)" stroke="none">
                <circle cx="23" cy="36.5" r="4.6" />
                <circle cx="41" cy="36.5" r="4.6" />
            </g>
            <g fill="white" stroke="none">
                <circle cx="24.6" cy="34.6" r="1.8" />
                <circle cx="42.6" cy="34.6" r="1.8" />
            </g>
            <g fill="var(--color-jalak-blush)" stroke="none">
                <ellipse cx="14" cy="46" rx="3.6" ry="2.2" />
                <ellipse cx="50" cy="46" rx="3.6" ry="2.2" />
            </g>
            <path
                d="M26.5 43.5Q32 39.5 37.5 43.5Q35.5 49 32 51Q28.5 49 26.5 43.5Z"
                fill="var(--color-jalak-beak)"
                strokeWidth="2.2"
            />
        </svg>
    );
}

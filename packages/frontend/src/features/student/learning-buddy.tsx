import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
export function LearningBuddy({
    cheers = 0,
    className,
}: {
    cheers?: number;
    className?: string;
}) {
    const [excited, setExcited] = useState(false);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    useEffect(() => () => clearTimeout(resetTimer.current), []);
    function greet() {
        clearTimeout(resetTimer.current);
        setExcited(true);
        resetTimer.current = setTimeout(() => setExcited(false), 1800);
    }
    useEffect(() => {
        if (cheers) greet();
    }, [cheers]);
    return (
        <div
            className={cn(
                'buddy-scene relative',
                excited && 'buddy--excited',
                className,
            )}
        >
            <p
                role="status"
                className={
                    excited
                        ? 'buddy-bubble text-primary-deep absolute right-0 bottom-full z-10 mb-1 w-max max-w-44 rounded-2xl bg-white px-3 py-2 text-sm leading-snug font-semibold shadow-md'
                        : 'sr-only'
                }
            >
                {excited && 'Yeay! Ayo, kita coba bersama!'}
            </p>
            <button
                type="button"
                onClick={greet}
                aria-label="Sapa teman buku"
                className="focus-visible:outline-ring block w-full rounded-3xl transition-transform duration-150 focus-visible:outline-3 focus-visible:outline-offset-4 active:scale-95"
            >
                <svg
                    viewBox="0 0 300 245"
                    fill="none"
                    aria-hidden="true"
                    className="w-full overflow-visible"
                >
                    <ellipse
                        cx="150"
                        cy="222"
                        rx="90"
                        ry="10"
                        fill="var(--color-primary-deep)"
                        opacity=".09"
                    />
                    <g className="buddy-body">
                        <g
                            stroke="var(--color-primary-deep)"
                            strokeWidth="7"
                            strokeLinecap="round"
                        >
                            <path d="m84 174-12 27-13 3m151-30 12 27 13 3" />
                        </g>
                        <g className="buddy-chest">
                            <path
                                d="M48 66Q95 44 148 65q53-22 103 1v124q-52-20-103 3-50-23-100-3Z"
                                fill="var(--color-primary)"
                                stroke="var(--color-primary-deep)"
                                strokeWidth="5"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M58 51q44-16 90 7 45-23 93-7v124q-46-15-93 8-44-23-90-8Z"
                                fill="white"
                                stroke="var(--color-primary-deep)"
                                strokeWidth="4"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M148 61v117"
                                stroke="var(--color-secondary)"
                                strokeWidth="4"
                            />
                            <path
                                d="M192 48v43l12-9 12 7V45"
                                fill="var(--color-activity-orange)"
                                stroke="var(--color-primary-deep)"
                                strokeWidth="3"
                                strokeLinejoin="round"
                            />
                            <path
                                d="m76 77 43-4m-43 15 30-3"
                                stroke="var(--color-secondary)"
                                strokeWidth="5"
                                strokeLinecap="round"
                            />
                            <g className="buddy-calm">
                                <g
                                    className="buddy-eyes"
                                    fill="var(--color-primary-deep)"
                                >
                                    <ellipse cx="105" cy="119" rx="7" ry="10" />
                                    <ellipse cx="186" cy="119" rx="7" ry="10" />
                                    <circle
                                        cx="107"
                                        cy="116"
                                        r="2"
                                        fill="white"
                                    />
                                    <circle
                                        cx="188"
                                        cy="116"
                                        r="2"
                                        fill="white"
                                    />
                                </g>
                                <path
                                    d="M132 137q14 17 28 0"
                                    stroke="var(--color-primary-deep)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                />
                            </g>
                            <g className="buddy-happy">
                                <path
                                    d="M94 120q11-18 22 0m59 0q11-18 22 0"
                                    stroke="var(--color-primary-deep)"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M130 137q18 8 36 0c0 30-36 30-36 0Z"
                                    fill="var(--color-primary-deep)"
                                />
                                <path
                                    d="M139 153q9-6 18 0-9 9-18 0Z"
                                    fill="var(--color-activity-orange)"
                                />
                            </g>
                            <g
                                fill="var(--color-activity-orange)"
                                opacity=".35"
                            >
                                <ellipse cx="86" cy="138" rx="11" ry="6" />
                                <ellipse cx="207" cy="138" rx="11" ry="6" />
                            </g>
                        </g>
                        <g
                            className="buddy-arm-left"
                            stroke="var(--color-primary-deep)"
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M50 130C31 135 21 121 24 103m0 3-9-10m9 10 2-15m-2 15 10-9" />
                        </g>
                        <g
                            className="buddy-arm-right"
                            stroke="var(--color-primary-deep)"
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M248 130c20 4 29-10 26-27m0 3 9-10m-9 10-2-15m2 15-10-9" />
                        </g>
                    </g>
                </svg>
            </button>
        </div>
    );
}

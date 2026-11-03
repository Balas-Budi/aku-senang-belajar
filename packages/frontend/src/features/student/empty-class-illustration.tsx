import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
export function EmptyClassIllustration({
    greets = 0,
    className,
}: {
    greets?: number;
    className?: string;
}) {
    const [greeting, setGreeting] = useState(false);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    useEffect(() => () => clearTimeout(resetTimer.current), []);
    function greet() {
        if (greeting) return;
        setGreeting(true);
        resetTimer.current = setTimeout(() => setGreeting(false), 4300);
    }
    useEffect(() => {
        if (greets) greet();
    }, [greets]);
    return (
        <div className={className}>
            <button
                type="button"
                onClick={greet}
                aria-label="Sapa teman di sekolah"
                className={cn(
                    'focus-visible:outline-ring block w-full rounded-2xl transition-transform duration-150 focus-visible:outline-3 focus-visible:outline-offset-4 active:scale-95',
                    greeting && 'school--greeting',
                )}
            >
                <svg
                    aria-hidden="true"
                    viewBox="0 0 240 180"
                    fill="none"
                    className="empty-class-art w-full overflow-visible"
                >
                    <ellipse
                        cx="117"
                        cy="164"
                        rx="87"
                        ry="9"
                        fill="var(--color-secondary)"
                    />
                    <g
                        stroke="var(--color-primary-deep)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path
                            d="M51 82h134v78H51Z"
                            fill="var(--color-secondary)"
                        />
                        <path
                            d="m40 84 78-53 79 53Z"
                            fill="var(--color-primary)"
                        />
                        <path
                            d="M103 112h31v48h-31Z"
                            fill="var(--color-primary-deep)"
                        />
                        <path
                            d="M67 104h19v23H67Zm85 0h19v23h-19Z"
                            fill="white"
                        />
                        <path d="M76 105v21m-8-11h17m76-10v21m-9-11h18" />
                        <g className="school-door">
                            <path d="M103 112h31v48h-31Z" fill="white" />
                            <circle
                                cx="126"
                                cy="138"
                                r="1.5"
                                fill="var(--color-primary-deep)"
                            />
                        </g>
                        <g className="school-visitor">
                            <path
                                d="m111 151-2 14m15-14 3 14"
                                strokeWidth="5"
                            />
                            <path
                                d="M109 138q9-5 17 0l2 15h-21Z"
                                fill="var(--color-activity-orange)"
                                strokeWidth="2"
                            />
                            <path
                                d="m109 141-5 7"
                                stroke="var(--color-student-skin)"
                                strokeWidth="5"
                            />
                            <g className="school-visitor-hand">
                                <path
                                    d="m126 140 8-2 1-9m0 1-3-3m3 3 3-3"
                                    stroke="var(--color-student-skin)"
                                    strokeWidth="4"
                                />
                            </g>
                            <circle
                                cx="118"
                                cy="128"
                                r="10"
                                fill="var(--color-student-skin)"
                                strokeWidth="1.5"
                            />
                            <path
                                d="M108 127q-3-15 10-13 12-2 11 13l-5-7q-6 6-16 2Z"
                                fill="var(--color-primary-deep)"
                                strokeWidth="1"
                            />
                            <path
                                d="M114 128v1m8-1v1m-7 4q3 3 6 0"
                                strokeWidth="1.5"
                            />
                        </g>
                        <g className="class-flag">
                            <path d="M118 31V9" />
                            <path
                                d="M119 9h30l-7 9 7 9h-30Z"
                                fill="var(--color-activity-orange)"
                            />
                        </g>
                        <g className="class-plane">
                            <path
                                d="m181 41 36-17-10 34-10-13-16-4Z"
                                fill="white"
                            />
                            <path d="m197 45 20-21" />
                        </g>
                        <path
                            d="m24 117-6-5m11-5-1-7m179 31 7-3"
                            stroke="var(--color-activity-orange)"
                        />
                    </g>
                </svg>
            </button>
            <span role="status" className="sr-only">
                {greeting ? 'Halo! Sampai jumpa di kelas!' : ''}
            </span>
        </div>
    );
}

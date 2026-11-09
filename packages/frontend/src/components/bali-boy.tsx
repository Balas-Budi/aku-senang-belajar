import { useId } from 'react';
import { cn } from '../lib/cn';

export type BaliBoyPose = 'stand' | 'wave' | 'cheer' | 'salam';

const loweredLeft = 'M88 170Q80 194 80 218';
const arms: Record<
    BaliBoyPose,
    { left: string; right: string; hands: [number, number][] }
> = {
    stand: {
        left: loweredLeft,
        right: 'M152 170Q160 194 160 218',
        hands: [
            [80, 222],
            [160, 222],
        ],
    },
    wave: {
        left: loweredLeft,
        right: 'M152 170Q192 166 202 126',
        hands: [
            [80, 222],
            [204, 116],
        ],
    },
    cheer: {
        left: 'M88 170Q48 160 38 120',
        right: 'M152 170Q192 160 202 120',
        hands: [
            [36, 110],
            [204, 110],
        ],
    },
    salam: {
        left: 'M88 170Q86 202 112 194',
        right: 'M152 170Q154 202 128 194',
        hands: [],
    },
};

function Sleeve({ d }: { d: string }) {
    return (
        <>
            <path d={d} strokeWidth="26" />
            <path d={d} stroke="white" strokeWidth="18" />
        </>
    );
}

function Hand({ x, y }: { x: number; y: number }) {
    if (y > 160)
        return <circle cx={x} cy={y} r="10" fill="var(--color-student-skin)" />;
    return (
        <g
            transform={`translate(${x} ${y + 4})${x < 120 ? ' scale(-1 1)' : ''}`}
            fill="var(--color-student-skin)"
        >
            <path d="M-6 0q-9-1-12-10q6-3 10 3" />
            <path d="M-9 2Q-11-16 0-17Q11-16 9 2Q8 11 0 11Q-8 11-9 2Z" />
            <path d="M-2-15v7M4-15v7" fill="none" strokeWidth="2.5" />
        </g>
    );
}

export function BaliBoy({
    pose = 'stand',
    className,
}: {
    pose?: BaliBoyPose;
    className?: string;
}) {
    const batik = `${useId()}-batik`;
    const kamen = `url(#${batik})`;
    const { left, right, hands } = arms[pose];
    const happy = pose === 'cheer';
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 240 320"
            fill="none"
            stroke="var(--color-jalak-ink)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('block overflow-visible', className)}
        >
            <defs>
                <pattern
                    id={batik}
                    width="16"
                    height="16"
                    patternUnits="userSpaceOnUse"
                >
                    <rect width="16" height="16" fill="var(--color-primary)" />
                    <path
                        d="M8 3l4 5-4 5-4-5Z"
                        fill="var(--color-secondary)"
                        stroke="none"
                    />
                    <path
                        d="M0 0h.01M16 0h.01M0 16h.01M16 16h.01"
                        stroke="var(--color-jalak-beak)"
                        strokeWidth="3.2"
                    />
                </pattern>
            </defs>
            <ellipse
                cx="120"
                cy="304"
                rx="60"
                ry="7"
                fill="var(--color-primary-deep)"
                opacity=".12"
                stroke="none"
            />
            <g fill="var(--color-student-skin)">
                <path d="M96 292q-14 0-14 8q0 5 8 5h18q4 0 4-6v-7Z" />
                <path d="M144 292q14 0 14 8q0 5-8 5h-18q-4 0-4-6v-7Z" />
            </g>
            <path d="M84 304h28M156 304h-28" strokeWidth="5" />
            <path d="M86 228L78 296Q120 302 162 296L154 228Z" fill={kamen} />
            <path
                d="M81 286Q120 292 159 286"
                stroke="var(--color-jalak-beak)"
                strokeWidth="4"
            />
            <path d="M102 236L114 308L126 308L136 236Z" fill={kamen} />
            <path
                d="M107 240L117 302M131 240L123 302"
                stroke="var(--color-jalak-beak)"
                strokeWidth="3.5"
            />
            <path
                d="M92 158Q120 150 148 158Q160 164 160 178L156 214Q120 222 84 214L80 178Q80 164 92 158Z"
                fill="white"
            />
            <path d="M120 162v46" strokeWidth="2.5" />
            <g fill="var(--color-jalak-ink)" stroke="none">
                <circle cx="120" cy="176" r="2" />
                <circle cx="120" cy="190" r="2" />
            </g>
            <path d="M104 156l16 10 16-10" strokeWidth="3.5" />
            <path
                d="M80 204Q120 214 160 204L164 240Q120 250 76 240Z"
                fill="var(--color-jalak-beak)"
            />
            <path
                d="M79 232Q120 242 161 232"
                stroke="var(--color-bread-crust)"
                strokeWidth="3"
            />
            <path d="M126 208L150 244" strokeWidth="3.5" />
            <path
                d="M80 200Q120 210 160 200L161 212Q120 222 79 212Z"
                fill="var(--color-activity-pink)"
            />
            <path
                d="M146 208q8 4 6 14M150 208q10 2 12 12"
                stroke="var(--color-activity-pink)"
                strokeWidth="5"
            />
            <Sleeve d={left} />
            <Sleeve d={right} />
            {hands.map(([x, y]) => (
                <Hand key={x} x={x} y={y} />
            ))}
            {pose === 'salam' && (
                <>
                    <path
                        d="M120 160C112 168 111 186 114 196L126 196C129 186 128 168 120 160Z"
                        fill="var(--color-student-skin)"
                    />
                    <path d="M120 166v28" strokeWidth="2.5" />
                </>
            )}
            <path
                d="M110 146v10q10 6 20 0v-10"
                fill="var(--color-student-skin)"
            />
            <g fill="var(--color-student-skin)">
                <ellipse cx="72" cy="112" rx="10" ry="13" />
                <ellipse cx="168" cy="112" rx="10" ry="13" />
            </g>
            <g fill="var(--color-jalak-ink)">
                <path d="M74 98Q72 84 80 76L92 86Q84 92 82 104Z" />
                <path d="M166 98Q168 84 160 76L148 86Q156 92 158 104Z" />
            </g>
            <path
                d="M120 66C150 66 168 84 168 110C168 134 148 150 120 150C92 150 72 134 72 110C72 84 90 66 120 66Z"
                fill="var(--color-student-skin)"
            />
            <path d="M94 94q8-5 16-1M130 93q8-4 16 1" strokeWidth="3.5" />
            {happy ? (
                <path d="M95 110q7-8 14 0M131 110q7-8 14 0" strokeWidth="4.5" />
            ) : (
                <g stroke="none">
                    <g fill="var(--color-jalak-ink)">
                        <ellipse cx="102" cy="110" rx="7" ry="9" />
                        <ellipse cx="138" cy="110" rx="7" ry="9" />
                    </g>
                    <g fill="white">
                        <circle cx="104.5" cy="106.5" r="2.6" />
                        <circle cx="140.5" cy="106.5" r="2.6" />
                    </g>
                </g>
            )}
            <g fill="var(--color-jalak-blush)" stroke="none">
                <ellipse cx="86" cy="126" rx="9" ry="5.5" />
                <ellipse cx="154" cy="126" rx="9" ry="5.5" />
            </g>
            <path d="M118 119q2 3 4 0" strokeWidth="3" />
            {happy ? (
                <>
                    <path
                        d="M108 128Q120 146 132 128Z"
                        fill="var(--color-jalak-ink)"
                        strokeWidth="3"
                    />
                    <path
                        d="M113 136q7-5 14 0q-7 6-14 0Z"
                        fill="var(--color-jalak-mouth)"
                        stroke="none"
                    />
                </>
            ) : (
                <path d="M110 130q10 9 20 0" />
            )}
            <path d="M72 86q-14-6-20 4q10 4 20 0" fill="white" />
            <path
                d="M70 92Q68 56 120 52Q172 56 170 92Q120 78 70 92Z"
                fill="white"
            />
            <path
                d="M70 92Q120 78 170 92L170 84Q120 70 70 84Z"
                fill="var(--color-jalak-beak)"
                strokeWidth="3"
            />
            <path
                d="M112 78Q124 56 144 36Q152 58 154 80Q132 70 112 78Z"
                fill="white"
            />
            <path d="M144 36Q139 56 134 72" strokeWidth="3" />
            <g transform="translate(172 100)">
                <g fill="white">
                    {[0, 72, 144, 216, 288].map((angle) => (
                        <ellipse
                            key={angle}
                            cy="-7"
                            rx="4.5"
                            ry="7"
                            transform={`rotate(${angle})`}
                        />
                    ))}
                </g>
                <circle r="3.5" fill="var(--color-jalak-beak)" stroke="none" />
            </g>
        </svg>
    );
}

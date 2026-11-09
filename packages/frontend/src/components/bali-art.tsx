import { useId, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type ArtProps = { className?: string };

function Art({
    viewBox,
    className,
    children,
}: ArtProps & { viewBox: string; children: ReactNode }) {
    return (
        <svg
            aria-hidden="true"
            viewBox={viewBox}
            fill="none"
            stroke="var(--color-jalak-ink)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('block overflow-visible', className)}
        >
            {children}
        </svg>
    );
}

function Block({
    box: [x1, y1, x2, y2],
    fill,
    strokeWidth,
}: {
    box: [number, number, number, number];
    fill: string;
    strokeWidth?: number;
}) {
    return (
        <path
            d={`M${x1} ${y1}H${x2}V${y2}H${x1}Z`}
            fill={fill}
            strokeWidth={strokeWidth}
        />
    );
}

function Shadow({ cx, cy, rx }: { cx: number; cy: number; rx: number }) {
    return (
        <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry="7"
            fill="var(--color-primary-deep)"
            opacity=".12"
            stroke="none"
        />
    );
}

const brick = 'var(--color-bali-brick)';
const stone = 'var(--color-bali-stone)';
const leaf = 'var(--color-bali-leaf)';
const gold = 'var(--color-jalak-beak)';
const wood = 'var(--color-bread-crust)';
const green = 'var(--color-activity-green)';

function GateHalf() {
    return (
        <>
            <Block box={[16, 212, 140, 240]} fill={stone} />
            <Block box={[30, 130, 140, 212]} fill={brick} />
            <path
                d="M30 150h22M30 172h22M30 194h22M118 150h22M118 172h22M118 194h22"
                strokeWidth="2"
                opacity=".35"
            />
            <Block box={[50, 144, 108, 200]} fill={stone} />
            <g transform="translate(79 172)" strokeWidth="3">
                {[0, 60, 120, 180, 240, 300].map((angle) => (
                    <ellipse
                        key={angle}
                        cy="-9"
                        rx="5"
                        ry="8"
                        fill="white"
                        transform={`rotate(${angle})`}
                    />
                ))}
                <circle r="4.5" fill={gold} />
            </g>
            <Block box={[24, 120, 140, 130]} fill={stone} />
            <Block box={[42, 98, 140, 120]} fill={brick} />
            <path d="M42 109h24M110 109h30" strokeWidth="2" opacity=".35" />
            <Block box={[38, 90, 140, 98]} fill={stone} />
            <Block box={[56, 72, 140, 90]} fill={brick} />
            <Block box={[52, 64, 140, 72]} fill={stone} />
            <Block box={[70, 50, 140, 64]} fill={brick} />
            <Block box={[86, 38, 140, 50]} fill={stone} />
            <path d="M100 38Q116 32 122 18Q132 10 140 2V38Z" fill={brick} />
            <path
                d="M26 120q-12-1-14-14q8 0 14 8M40 90q-12-1-14-14q8 0 14 8M54 64q-12-1-14-14q8 0 14 8M88 38q-12-1-14-14q8 0 14 8"
                fill={stone}
            />
        </>
    );
}

export function CandiBentar({ className }: ArtProps) {
    return (
        <Art viewBox="0 0 320 250" className={className}>
            <Shadow cx={160} cy={242} rx={150} />
            <GateHalf />
            <g transform="matrix(-1 0 0 1 320 0)">
                <GateHalf />
            </g>
            <Block box={[128, 230, 192, 242]} fill={stone} />
            <Block box={[134, 220, 186, 230]} fill={stone} />
            <Block box={[140, 212, 180, 220]} fill={stone} />
        </Art>
    );
}

const penjorPole =
    'M54 304C50 220 48 140 62 84C74 44 110 26 140 40C156 48 162 66 158 88';
const penjorStrands = 'M151 114l-7 28M158 118v26M165 114l7 28';

export function Penjor({ className }: ArtProps) {
    return (
        <Art viewBox="0 0 200 320" className={className}>
            <Shadow cx={56} cy={308} rx={34} />
            <path
                d="M61 75H71L67 96ZM69 61H79L75 82ZM81 50H91L87 71ZM95 42H105L101 63ZM111 38H121L117 59ZM127 40H137L133 61ZM141 47H151L147 68Z"
                fill={leaf}
                strokeWidth="3"
            />
            <path d={penjorPole} strokeWidth="14" />
            <path d={penjorPole} stroke={gold} strokeWidth="7" />
            <path
                d="M57 116q-14 2-20 14q12 0 20-8ZM57 116q14 2 20 14q-12 0-20-8ZM57 140q-14 2-20 14q12 0 20-8ZM57 140q14 2 20 14q-12 0-20-8ZM57 164q-14 2-20 14q12 0 20-8ZM57 164q14 2 20 14q-12 0-20-8Z"
                fill={leaf}
                strokeWidth="3"
            />
            <path d={penjorStrands} strokeWidth="7" />
            <path d={penjorStrands} stroke={leaf} strokeWidth="3" />
            <path d="M144 98H172L168 112Q158 126 148 112Z" fill={leaf} />
            <path d="M150 106h16" stroke={gold} strokeWidth="3" />
            <circle cx="158" cy="92" r="6" fill={gold} strokeWidth="3" />
            <path d="M34 196L52 182L70 196Z" fill={wood} />
            <Block box={[36, 196, 68, 218]} fill={wood} />
            <Block box={[44, 202, 60, 214]} fill={gold} strokeWidth={3} />
            <path d="M40 218h24l-3 44l-9 10l-9-10Z" fill="white" />
            <path
                d="M52 228l6 8-6 8-6-8ZM52 250l5 7-5 7-5-7Z"
                fill={leaf}
                strokeWidth="2.5"
            />
            <Block box={[38, 296, 70, 308]} fill={stone} />
        </Art>
    );
}

function Blossom({ x, y, fill }: { x: number; y: number; fill: string }) {
    return (
        <g transform={`translate(${x} ${y}) scale(1 .7)`} strokeWidth="2.5">
            {[0, 72, 144, 216, 288].map((angle) => (
                <ellipse
                    key={angle}
                    cy="-6.5"
                    rx="4.5"
                    ry="7"
                    fill={fill}
                    transform={`rotate(${angle})`}
                />
            ))}
            <circle
                r="3"
                fill={fill === gold ? 'white' : gold}
                strokeWidth="2"
            />
        </g>
    );
}

export function CanangSari({ className }: ArtProps) {
    return (
        <Art viewBox="0 0 140 120" className={className}>
            <Shadow cx={70} cy={104} rx={54} />
            <path d="M86 52L100 10" strokeWidth="5" />
            <path d="M86 52L100 10" stroke={wood} strokeWidth="2" />
            <path
                d="M100 10q-8-8 0-16t0-14"
                stroke="var(--color-border)"
                strokeWidth="2.5"
                opacity=".7"
            />
            <path d="M16 64V76L70 100L124 76V64" fill={green} />
            <path
                d="M16 70L70 94L124 70M34 82v-6M52 90v-6M88 90v-6M106 82v-6"
                strokeWidth="2"
                opacity=".45"
            />
            <path d="M16 64L70 40L124 64L70 88Z" fill={leaf} />
            <Blossom x={70} y={51} fill="white" />
            <Blossom x={44} y={64} fill="var(--color-activity-pink)" />
            <Blossom x={96} y={64} fill={gold} />
            <path d="M62 64l8-5 8 5-8 5Z" fill={green} strokeWidth="2.5" />
            <Blossom x={70} y={77} fill="var(--color-activity-blue)" />
        </Art>
    );
}

const meruTiers = [0, 1, 2, 3, 4].map((tier) => {
    const bottom = 196 - tier * 26;
    const top = bottom - 18;
    const eave = 64 - tier * 10;
    const crown = Math.round(eave * 0.55);
    return { tier, bottom, top, eave, crown, post: Math.round(crown * 0.7) };
});

export function Meru({ className }: ArtProps) {
    return (
        <Art viewBox="0 0 160 280" className={className}>
            <Shadow cx={80} cy={270} rx={62} />
            <Block box={[22, 244, 138, 268]} fill={stone} />
            <Block box={[30, 232, 130, 244]} fill={stone} />
            <Block box={[50, 196, 110, 232]} fill={wood} />
            <Block box={[68, 204, 92, 232]} fill={gold} />
            <Block
                box={[73, 210, 87, 232]}
                fill="var(--color-primary-deep)"
                strokeWidth={3}
            />
            {meruTiers.map(({ tier, bottom, top, eave, crown, post }) => (
                <g key={tier}>
                    <Block
                        box={[80 - post, top - 8, 80 + post, top]}
                        fill={wood}
                        strokeWidth={3}
                    />
                    <path
                        d={`M${80 - eave} ${bottom}Q80 ${bottom + 7} ${80 + eave} ${bottom}L${80 + crown} ${top}H${80 - crown}Z`}
                        fill="var(--color-primary-deep)"
                    />
                    <path
                        d={`M${88 - eave} ${bottom - 4}Q80 ${bottom + 2} ${72 + eave} ${bottom - 4}`}
                        stroke="var(--color-primary)"
                        strokeWidth="3"
                    />
                </g>
            ))}
            <path d="M73 66Q80 50 80 34Q80 50 87 66Z" fill={gold} />
            <circle cx="80" cy="30" r="5" fill={gold} />
        </Art>
    );
}

export function Tedung({ className }: ArtProps) {
    return (
        <Art viewBox="0 0 120 270" className={className}>
            <Shadow cx={60} cy={260} rx={30} />
            <path d="M60 70V252" strokeWidth="11" />
            <path d="M60 70V252" stroke={wood} strokeWidth="5" />
            <path d="M14 76Q16 36 60 28Q104 36 106 76Z" fill={gold} />
            <path d="M28 64Q60 52 92 64" stroke={wood} strokeWidth="3" />
            <path
                d="M14 76H106V84Q104 86 100 86H20Q16 86 14 84Z"
                fill="white"
            />
            <path
                d="M16 86q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0q6 10 12 0"
                fill="white"
            />
            <path d="M54 28Q60 14 60 6Q60 14 66 28Z" fill={gold} />
            <Block box={[48, 248, 72, 258]} fill={stone} />
        </Art>
    );
}

const palmTrunk = 'M254 126Q250 86 266 50';

export function RiceTerraces({ className }: ArtProps) {
    const clip = `${useId()}-terraces`;
    return (
        <Art viewBox="0 0 320 180" className={className}>
            <defs>
                <clipPath id={clip}>
                    <rect width="320" height="180" rx="28" />
                </clipPath>
            </defs>
            <rect
                width="320"
                height="180"
                rx="28"
                fill="var(--color-student-surface)"
                stroke="none"
            />
            <g clipPath={`url(#${clip})`}>
                <path d="M0 64Q80 40 160 58T320 50V180H0Z" fill={leaf} />
                <path d="M0 100Q90 76 170 96T320 86V180H0Z" fill={green} />
                <path
                    d="M0 108Q90 84 170 104T320 94"
                    stroke={leaf}
                    strokeWidth="3"
                />
                <path
                    d="M0 136Q100 110 180 132T320 122V180H0Z"
                    fill="var(--color-secondary)"
                />
                <path
                    d="M30 146q20-6 40 0M150 140q24-6 48 0M240 132q16-4 32 0"
                    stroke="white"
                    strokeWidth="3"
                />
                <path d="M0 164Q110 146 200 160T320 154V180H0Z" fill={green} />
                <path
                    d={[
                        [40, 84],
                        [60, 80],
                        [120, 78],
                        [140, 80],
                        [210, 92],
                        [228, 94],
                        [44, 158],
                        [190, 156],
                        [210, 156],
                    ]
                        .map(
                            ([x, y]) =>
                                `M${x} ${y}q-1-9-9-14M${x} ${y}q0-9 1-16M${x} ${y}q2-9 9-13`,
                        )
                        .join('')}
                    stroke="var(--color-primary-deep)"
                    strokeWidth="2.5"
                    opacity=".4"
                />
                <path d={palmTrunk} strokeWidth="10" />
                <path d={palmTrunk} stroke={wood} strokeWidth="4" />
                <path
                    d="M266 48Q242 38 222 56Q244 48 266 52ZM266 48Q250 22 228 24Q250 32 264 50ZM266 48Q282 22 304 26Q284 32 268 50ZM266 48Q292 42 308 62Q288 52 268 52ZM266 48Q266 26 274 14Q276 32 270 48Z"
                    fill={green}
                    strokeWidth="3.5"
                />
                <g fill={wood} strokeWidth="3.5">
                    <circle cx="262" cy="54" r="5" />
                    <circle cx="271" cy="55" r="5" />
                </g>
            </g>
            <rect x="2" y="2" width="316" height="176" rx="26" />
        </Art>
    );
}

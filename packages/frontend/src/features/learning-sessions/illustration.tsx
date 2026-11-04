import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

const bread = 'var(--color-bread)';
const marked = 'var(--color-activity-pink)';

function round(value: number) {
    return Math.round(value * 100) / 100;
}

function slab(x: number, width: number, left: number, right: number) {
    const end = x + width;

    return `M${x + left} 32H${end - right}A${right} ${right} 0 0 1 ${end} ${32 + right}V${88 - right}A${right} ${right} 0 0 1 ${end - right} 88H${x + left}A${left} ${left} 0 0 1 ${x} ${88 - left}V${32 + left}A${left} ${left} 0 0 1 ${x + left} 32Z`;
}

function slices(widths: number[], markedPiece?: number) {
    return widths.map((width, index) => {
        const x =
            16 + widths.slice(0, index).reduce((sum, w) => sum + w + 4, 0);

        return (
            <path
                key={x}
                d={slab(
                    x,
                    width,
                    index === 0 ? 14 : 4,
                    index === widths.length - 1 ? 14 : 4,
                )}
                fill={index === markedPiece ? marked : bread}
            />
        );
    });
}

function point(angle: number) {
    const radians = (angle * Math.PI) / 180;

    return `${round(80 + 48 * Math.sin(radians))} ${round(60 - 48 * Math.cos(radians))}`;
}

function wedges(bounds: number[], markedPiece?: number) {
    return bounds.slice(1).map((to, index) => {
        const from = bounds[index];
        const middle = (((from + to) / 2) * Math.PI) / 180;

        return (
            <path
                key={from}
                d={`M80 60L${point(from)}A48 48 0 ${to - from > 180 ? 1 : 0} 1 ${point(to)}Z`}
                transform={`translate(${round(3 * Math.sin(middle))} ${round(-3 * Math.cos(middle))})`}
                fill={index === markedPiece ? marked : bread}
            />
        );
    });
}

const drawings = {
    'loaf-whole': {
        label: 'Satu roti utuh',
        drawing: (
            <>
                <path d={slab(16, 128, 14, 14)} fill={bread} />
                <path
                    d="M46 46l12 28M74 46l12 28M102 46l12 28"
                    stroke="var(--color-bread-crust)"
                    strokeWidth="4"
                />
            </>
        ),
    },
    'loaf-quarters': {
        label: 'Roti dipotong menjadi 4 bagian yang sama besar',
        drawing: slices([29, 29, 29, 29]),
    },
    'loaf-quarters-unequal': {
        label: 'Roti dipotong menjadi 4 bagian yang ukurannya berbeda-beda',
        drawing: slices([44, 14, 22, 36]),
    },
    'loaf-quarter-marked': {
        label: 'Roti dipotong menjadi 4 bagian yang sama besar, satu bagian diberi warna',
        drawing: slices([29, 29, 29, 29], 0),
    },
    'loaf-halves': {
        label: 'Roti dipotong menjadi 2 bagian yang sama besar',
        drawing: slices([62, 62]),
    },
    'loaf-pair': {
        label: 'Dua roti utuh yang sama besar',
        drawing: (
            <>
                <path d={slab(8, 64, 14, 14)} fill={bread} />
                <path d={slab(88, 64, 14, 14)} fill={bread} />
                <path
                    d="M26 46l8 28M44 46l8 28M106 46l8 28M124 46l8 28"
                    stroke="var(--color-bread-crust)"
                    strokeWidth="4"
                />
            </>
        ),
    },
    'round-quarters': {
        label: 'Roti bundar dipotong menjadi 4 bagian yang sama besar',
        drawing: wedges([0, 90, 180, 270, 360]),
    },
    'round-quarters-unequal': {
        label: 'Roti bundar dipotong menjadi 4 bagian yang ukurannya berbeda-beda',
        drawing: wedges([0, 150, 240, 310, 360]),
    },
    'round-quarter-marked': {
        label: 'Roti bundar dipotong menjadi 4 bagian yang sama besar, satu bagian diberi warna',
        drawing: wedges([0, 90, 180, 270, 360], 0),
    },
    'round-thirds': {
        label: 'Roti bundar dipotong menjadi 3 bagian yang sama besar',
        drawing: wedges([0, 120, 240, 360]),
    },
    'paper-quarters': {
        label: 'Kertas dilipat menjadi 4 bagian yang sama besar, satu bagian diberi warna',
        drawing: (
            <>
                <rect
                    x="35"
                    y="15"
                    width="90"
                    height="90"
                    fill="white"
                    stroke="none"
                />
                <rect
                    x="35"
                    y="15"
                    width="45"
                    height="45"
                    fill={marked}
                    stroke="none"
                />
                <path
                    d="M80 15v90M35 60h90"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                />
                <rect x="35" y="15" width="90" height="90" fill="none" />
            </>
        ),
    },
} satisfies Record<string, { label: string; drawing: ReactNode }>;

export type IllustrationName = keyof typeof drawings;

export function Illustration({
    name,
    className,
    ...props
}: ComponentProps<'svg'> & { name: IllustrationName }) {
    return (
        <svg
            viewBox="0 0 160 120"
            role="img"
            aria-label={drawings[name].label}
            fill="none"
            stroke="var(--color-primary-deep)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('w-full', className)}
            {...props}
        >
            {drawings[name].drawing}
        </svg>
    );
}

import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export type DiagramFill =
    'none' | 'paper' | 'soft' | 'mark' | 'blue' | 'green' | 'yellow';
export type DiagramStroke = 'ink' | 'mark';
type Point = [number, number];
type Line = { stroke?: DiagramStroke; dashed?: boolean };
type Split = { parts?: number; shaded?: number };
export type DiagramShape =
    | ({
          type: 'rect';
          x: number;
          y: number;
          width: number;
          height: number;
          fill: DiagramFill;
      } & Split &
          Line)
    | ({
          type: 'circle';
          cx: number;
          cy: number;
          r: number;
          fill: DiagramFill;
      } & Split &
          Line)
    | ({
          type: 'ellipse';
          cx: number;
          cy: number;
          rx: number;
          ry: number;
          fill: DiagramFill;
      } & Line)
    | ({ type: 'line'; x1: number; y1: number; x2: number; y2: number } & Line)
    | ({ type: 'polyline'; points: Point[] } & Line)
    | ({ type: 'polygon'; points: Point[]; fill: DiagramFill } & Line)
    | ({ type: 'path'; d: string; fill: DiagramFill } & Line)
    | {
          type: 'text';
          x: number;
          y: number;
          text: string;
          anchor?: 'start' | 'middle' | 'end';
      };
export type Diagram = { label: string; shapes: DiagramShape[] };

const ink = 'var(--color-primary-deep)';
const fills = {
    none: 'none',
    paper: 'var(--color-background)',
    soft: 'var(--color-secondary)',
    mark: 'var(--color-activity-pink)',
    blue: 'var(--color-activity-blue)',
    green: 'var(--color-activity-green)',
    yellow: 'var(--color-bread)',
} satisfies Record<DiagramFill, string>;
const strokes = {
    ink: { stroke: ink, strokeWidth: 2.5 },
    mark: { stroke: 'var(--color-activity-pink)', strokeWidth: 4 },
} satisfies Record<DiagramStroke, { stroke: string; strokeWidth: number }>;

const n = (v: number) => Math.round(v * 100) / 100;
const dash = (dashed?: boolean) => (dashed ? { strokeDasharray: '6 5' } : {});
const paint = (fill: DiagramFill): string => fills[fill] ?? 'none';
const pointList = (points: Point[]) =>
    points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
const partsFills: DiagramFill[] = ['paper', 'soft', 'yellow'];
const partFill = (shape: { fill: DiagramFill; shaded?: number }, i: number) =>
    i < (shape.shaded ?? 0)
        ? fills.mark
        : paint(partsFills.includes(shape.fill) ? shape.fill : 'paper');
const spoken = (s: string) =>
    s
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/ ?\/ ?/g, '/')
        .trim();

export function diagramName({ label, shapes }: Diagram) {
    const said = spoken(label);
    const unsaid = new Set(
        shapes.flatMap((s) =>
            s.type === 'text' && !said.includes(spoken(s.text)) ? [s.text] : [],
        ),
    );
    if (unsaid.size === 0) return label;
    const sentence = /[.!?]$/.test(label) ? label : `${label}.`;
    return `${sentence} Tulisan di gambar: ${[...unsaid].join(', ')}.`;
}

function wedge(cx: number, cy: number, r: number, parts: number, i: number) {
    const a0 = (360 * i) / parts;
    const a1 = (360 * (i + 1)) / parts;
    const p = (a: number) => {
        const radians = (a * Math.PI) / 180;
        return `${n(cx + r * Math.sin(radians))} ${n(cy - r * Math.cos(radians))}`;
    };
    return `M${n(cx)} ${n(cy)}L${p(a0)}A${n(r)} ${n(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}Z`;
}

function Shape({ shape }: { shape: DiagramShape }) {
    switch (shape.type) {
        case 'rect': {
            const { x, y, width, height, parts } = shape;
            if (!parts)
                return (
                    <rect
                        x={n(x)}
                        y={n(y)}
                        width={n(width)}
                        height={n(height)}
                        fill={paint(shape.fill)}
                        {...dash(shape.dashed)}
                    />
                );
            const wide = width >= height;
            const step = (wide ? width : height) / parts;
            return Array.from({ length: parts }, (_, i) => (
                <rect
                    key={i}
                    x={n(wide ? x + i * step : x)}
                    y={n(wide ? y : y + i * step)}
                    width={n(wide ? step : width)}
                    height={n(wide ? height : step)}
                    fill={partFill(shape, i)}
                    {...dash(shape.dashed)}
                />
            ));
        }
        case 'circle': {
            const { cx, cy, r, parts } = shape;
            if (!parts)
                return (
                    <circle
                        cx={n(cx)}
                        cy={n(cy)}
                        r={n(r)}
                        fill={paint(shape.fill)}
                        {...dash(shape.dashed)}
                    />
                );
            return Array.from({ length: parts }, (_, i) => (
                <path
                    key={i}
                    d={wedge(cx, cy, r, parts, i)}
                    fill={partFill(shape, i)}
                    {...dash(shape.dashed)}
                />
            ));
        }
        case 'ellipse':
            return (
                <ellipse
                    cx={n(shape.cx)}
                    cy={n(shape.cy)}
                    rx={n(shape.rx)}
                    ry={n(shape.ry)}
                    fill={paint(shape.fill)}
                    {...dash(shape.dashed)}
                />
            );
        case 'line':
            return (
                <line
                    x1={n(shape.x1)}
                    y1={n(shape.y1)}
                    x2={n(shape.x2)}
                    y2={n(shape.y2)}
                    {...strokes[shape.stroke ?? 'ink']}
                    {...dash(shape.dashed)}
                />
            );
        case 'polyline':
            return (
                <polyline
                    points={pointList(shape.points)}
                    {...strokes[shape.stroke ?? 'ink']}
                    {...dash(shape.dashed)}
                />
            );
        case 'polygon':
            return (
                <polygon
                    points={pointList(shape.points)}
                    fill={paint(shape.fill)}
                    {...dash(shape.dashed)}
                />
            );
        case 'path':
            return (
                <path
                    d={shape.d}
                    fill={paint(shape.fill)}
                    {...strokes[shape.stroke ?? 'ink']}
                    {...dash(shape.dashed)}
                />
            );
        case 'text':
            return (
                <text
                    x={n(shape.x)}
                    y={n(shape.y)}
                    textAnchor={shape.anchor ?? 'middle'}
                    dominantBaseline="central"
                    fontSize={16}
                    fontWeight={700}
                    className="font-rounded"
                    fill={ink}
                    stroke="var(--color-background)"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                >
                    {shape.text}
                </text>
            );
        default:
            shape satisfies never;
            return null;
    }
}

export function DiagramPicture({
    diagram,
    className,
    ...props
}: ComponentProps<'svg'> & { diagram: Diagram }) {
    return (
        <svg
            viewBox="-2 -2 164 124"
            role="img"
            aria-label={
                props['aria-labelledby'] || props['aria-hidden']
                    ? undefined
                    : diagramName(diagram)
            }
            fill="none"
            stroke={ink}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('w-full min-w-40', className)}
            {...props}
        >
            {diagram.shapes.map((shape, i) => (
                <Shape key={i} shape={shape} />
            ))}
        </svg>
    );
}

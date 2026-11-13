import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Sticker } from '../../components/sticker';
import {
    subjectsQuery,
    type SubjectColor,
    type SubjectIcon,
    type SubjectInfo,
} from '../subjects/queries';
import type { Subject } from './queries';

/** Tailwind needs whole class names, so every colour spells its tint out. */
export const palette: Record<
    SubjectColor,
    { label: string; tint: string; color: string; swatch: string }
> = {
    pink: {
        label: 'Merah muda',
        tint: 'bg-activity-pink/15',
        color: 'var(--color-activity-pink)',
        swatch: 'bg-activity-pink',
    },
    blue: {
        label: 'Biru',
        tint: 'bg-activity-blue/15',
        color: 'var(--color-activity-blue)',
        swatch: 'bg-activity-blue',
    },
    green: {
        label: 'Hijau',
        tint: 'bg-activity-green/15',
        color: 'var(--color-activity-green)',
        swatch: 'bg-activity-green',
    },
    orange: {
        label: 'Oranye',
        tint: 'bg-activity-orange/15',
        color: 'var(--color-activity-orange)',
        swatch: 'bg-activity-orange',
    },
    purple: {
        label: 'Ungu',
        tint: 'bg-primary/15',
        color: 'var(--color-primary)',
        swatch: 'bg-primary',
    },
};

/** Drawings on a 48 by 48 grid, each filled with the subject's colour. */
export const drawings: Record<
    SubjectIcon,
    { label: string; draw: (color: string) => ReactNode }
> = {
    mathematics: {
        label: 'Angka',
        draw: (color) => (
            <>
                <circle cx="24" cy="24" r="16" fill="white" />
                <path d="M24 24V8a16 16 0 0 1 16 16z" fill={color} />
                <path d="M24 8v32M8 24h32" />
            </>
        ),
    },
    natural_and_social_science: {
        label: 'Tunas',
        draw: (color) => (
            <>
                <path d="M24 41V24M16 41h16" />
                <path d="M24 28c-9 0-13-5-13-12 8 0 13 4 13 12z" fill={color} />
                <path d="M24 24c0-8 5-12 13-12 0 7-4 12-13 12z" fill={color} />
            </>
        ),
    },
    indonesian_language: {
        label: 'Buku terbuka',
        draw: (color) => (
            <>
                <path
                    d="M24 15c-5-4-11-4-17-3v25c6-1 12-1 17 3 5-4 11-4 17-3V12c-6-1-12-1-17 3z"
                    fill={color}
                />
                <path
                    d="M12 19.5c3-.5 6 0 8 1.2M12 25.5c3-.5 6 0 8 1.2M28 20.7c2-1.2 5-1.7 8-1.2M28 26.7c2-1.2 5-1.7 8-1.2"
                    stroke="white"
                />
                <path d="M24 15v25" />
            </>
        ),
    },
    pancasila_education: {
        label: 'Perisai',
        draw: (color) => (
            <>
                <path
                    d="M24 6l15 5v11c0 10-6.5 16.5-15 20-8.5-3.5-15-10-15-20V11z"
                    fill="white"
                />
                <path
                    d="M24 15l2.1 6.1 6.5.1-5.2 3.9 1.9 6.2-5.3-3.7-5.3 3.7 1.9-6.2-5.2-3.9 6.5-.1z"
                    fill={color}
                    strokeWidth="2"
                />
            </>
        ),
    },
    book: {
        label: 'Buku',
        draw: (color) => (
            <>
                <path
                    d="M12 8h22a2 2 0 0 1 2 2v30H14a4 4 0 0 1-4-4V10a2 2 0 0 1 2-2z"
                    fill={color}
                />
                <path d="M10 36a4 4 0 0 1 4-4h22" />
                <path d="M17 15h12M17 21h9" stroke="white" />
            </>
        ),
    },
    globe: {
        label: 'Bola dunia',
        draw: (color) => (
            <>
                <circle cx="24" cy="24" r="16" fill="white" />
                <path
                    d="M15 13c3 3 2 6 6 7s2 6 6 6 4 6 2 10M33 12c-2 3 0 5 3 6"
                    stroke={color}
                    strokeWidth="4"
                />
                <circle cx="24" cy="24" r="16" />
            </>
        ),
    },
    music: {
        label: 'Not musik',
        draw: (color) => (
            <>
                <path d="M19 33V11l18-4v22" />
                <circle cx="14" cy="33" r="5" fill={color} />
                <circle cx="32" cy="29" r="5" fill={color} />
                <path d="M19 17l18-4" />
            </>
        ),
    },
    brush: {
        label: 'Kuas',
        draw: (color) => (
            <>
                <path d="M38 8L22 26l4 4L42 12a3 3 0 0 0-4-4z" fill="white" />
                <path
                    d="M20 28c-5 0-8 3-8 7 0 3-2 4-4 5 5 2 13 1 16-3 2-3 1-6-4-9z"
                    fill={color}
                />
            </>
        ),
    },
    ball: {
        label: 'Bola',
        draw: (color) => (
            <>
                <circle cx="24" cy="24" r="16" fill="white" />
                <path d="M24 16l7 5-3 8h-8l-3-8z" fill={color} />
                <path d="M24 8v8M31 21l8-3M28 29l5 7M20 29l-5 7M17 21l-8-3" />
                <circle cx="24" cy="24" r="16" />
            </>
        ),
    },
    leaf: {
        label: 'Daun',
        draw: (color) => (
            <>
                <path
                    d="M10 38C10 20 20 10 40 8c0 20-10 30-28 30z"
                    fill={color}
                />
                <path d="M10 38l18-18" stroke="white" />
                <path d="M10 38l-2 2" />
            </>
        ),
    },
    prayer: {
        label: 'Bulan bintang',
        draw: (color) => (
            <>
                <path
                    d="M30 8a16 16 0 1 0 10 26A13 13 0 0 1 30 8z"
                    fill={color}
                />
                <path
                    d="M35 14l1.2 3.4 3.6.1-2.9 2.2 1 3.4-2.9-2-2.9 2 1-3.4-2.9-2.2 3.6-.1z"
                    fill="white"
                    strokeWidth="1.8"
                />
            </>
        ),
    },
    computer: {
        label: 'Komputer',
        draw: (color) => (
            <>
                <rect x="8" y="10" width="32" height="22" rx="3" fill="white" />
                <rect
                    x="12"
                    y="14"
                    width="24"
                    height="14"
                    rx="1.5"
                    fill={color}
                />
                <path d="M18 40h12M24 32v8" />
            </>
        ),
    },
};

const fallback = {
    color: 'purple' as SubjectColor,
    icon: 'book' as SubjectIcon,
};

const isColor = (value: string): value is SubjectColor =>
    Object.hasOwn(palette, value);
const isIcon = (value: string): value is SubjectIcon =>
    Object.hasOwn(drawings, value);

/** Everything a screen needs to show one subject: name, tint, colour, drawing. */
export function subjectLook(
    info: Pick<SubjectInfo, 'name' | 'color' | 'icon'> | undefined,
    key: string,
) {
    const color =
        palette[info && isColor(info.color) ? info.color : fallback.color];
    const icon =
        drawings[info && isIcon(info.icon) ? info.icon : fallback.icon];
    return {
        label: info?.name ?? 'Mata pelajaran',
        key,
        tint: color.tint,
        color: color.color,
        drawing: icon.draw(color.color),
    };
}

export function useSubjects() {
    const list = useQuery(subjectsQuery()).data;
    return {
        list: list ?? [],
        of: (key: Subject) =>
            subjectLook(
                list?.find((item) => item.key === key),
                key,
            ),
    };
}

export function useSubject(key: Subject) {
    return useSubjects().of(key);
}

export function SubjectName({ subject }: { subject: Subject }) {
    return <>{useSubject(subject).label}</>;
}

export function SubjectArt({
    subject,
    className,
}: {
    subject: Subject;
    className?: string;
}) {
    const look = useSubject(subject);
    return (
        <Sticker tint={look.tint} className={className}>
            {look.drawing}
        </Sticker>
    );
}

/** Preview for a colour and icon not saved yet. */
export function SubjectPreview({
    color,
    icon,
    className,
}: {
    color: SubjectColor;
    icon: SubjectIcon;
    className?: string;
}) {
    return (
        <Sticker tint={palette[color].tint} className={className}>
            {drawings[icon].draw(palette[color].color)}
        </Sticker>
    );
}

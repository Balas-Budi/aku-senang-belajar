import type { ReactNode } from 'react';
import { Sticker } from '../../components/sticker';
import type { Subject } from './queries';
export const subjects: Record<
    Subject,
    { label: string; tint: string; drawing: ReactNode }
> = {
    mathematics: {
        label: 'Matematika',
        tint: 'bg-activity-pink/15',
        drawing: (
            <>
                <circle cx="24" cy="24" r="16" fill="white" />
                <path
                    d="M24 24V8a16 16 0 0 1 16 16z"
                    fill="var(--color-activity-pink)"
                />
                <path d="M24 8v32M8 24h32" />
            </>
        ),
    },
    natural_and_social_science: {
        label: 'IPAS',
        tint: 'bg-activity-green/15',
        drawing: (
            <>
                <path d="M24 41V24M16 41h16" />
                <path
                    d="M24 28c-9 0-13-5-13-12 8 0 13 4 13 12z"
                    fill="var(--color-activity-green)"
                />
                <path
                    d="M24 24c0-8 5-12 13-12 0 7-4 12-13 12z"
                    fill="var(--color-activity-green)"
                />
            </>
        ),
    },
    indonesian_language: {
        label: 'Bahasa Indonesia',
        tint: 'bg-activity-blue/15',
        drawing: (
            <>
                <path
                    d="M24 15c-5-4-11-4-17-3v25c6-1 12-1 17 3 5-4 11-4 17-3V12c-6-1-12-1-17 3z"
                    fill="var(--color-activity-blue)"
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
        label: 'Pendidikan Pancasila',
        tint: 'bg-activity-orange/15',
        drawing: (
            <>
                <path
                    d="M24 6l15 5v11c0 10-6.5 16.5-15 20-8.5-3.5-15-10-15-20V11z"
                    fill="white"
                />
                <path
                    d="M24 15l2.1 6.1 6.5.1-5.2 3.9 1.9 6.2-5.3-3.7-5.3 3.7 1.9-6.2-5.2-3.9 6.5-.1z"
                    fill="var(--color-activity-orange)"
                    strokeWidth="2"
                />
            </>
        ),
    },
};
export function SubjectArt({
    subject,
    className,
}: {
    subject: Subject;
    className?: string;
}) {
    return (
        <Sticker tint={subjects[subject].tint} className={className}>
            {subjects[subject].drawing}
        </Sticker>
    );
}

import { cn } from '../../lib/cn';
import type { Subject } from '../assignments/queries';
import { useSubject } from '../assignments/subject-art';

const edge =
    'M60 12A13 13 0 0 1 84 18.43A13 13 0 0 1 101.57 36A13 13 0 0 1 108 60A13 13 0 0 1 101.57 84A13 13 0 0 1 84 101.57A13 13 0 0 1 60 108A13 13 0 0 1 36 101.57A13 13 0 0 1 18.43 84A13 13 0 0 1 12 60A13 13 0 0 1 18.43 36A13 13 0 0 1 36 18.43A13 13 0 0 1 60 12Z';

export function ChapterSticker({
    subject,
    className,
}: {
    subject: Subject;
    className?: string;
}) {
    const look = useSubject(subject);
    return (
        <svg
            viewBox="0 0 120 120"
            aria-hidden="true"
            className={cn('shrink-0 -rotate-6', className)}
        >
            <path
                transform="translate(0 4)"
                fill="var(--color-paper-edge)"
                d={edge}
            />
            <path
                fill={look.color}
                stroke="white"
                strokeWidth="7"
                strokeLinejoin="round"
                d={edge}
            />
            <circle cx="60" cy="60" r="31" fill="white" />
            <g
                transform="translate(36 36)"
                fill="none"
                stroke="var(--color-primary-deep)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {look.drawing}
            </g>
            <circle
                cx="92"
                cy="92"
                r="13"
                fill="var(--color-primary)"
                stroke="white"
                strokeWidth="4"
            />
            <path
                d="M86 92.5l4 4 8-8.5"
                fill="none"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

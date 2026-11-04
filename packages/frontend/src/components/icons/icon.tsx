import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
export function Icon({ className, ...props }: ComponentProps<'svg'>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cn('size-5 shrink-0', className)}
            {...props}
        />
    );
}

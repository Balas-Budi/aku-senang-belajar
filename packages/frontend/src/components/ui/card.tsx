import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'border-paper-edge bg-background rounded-2xl border p-5',
                className,
            )}
            {...props}
        />
    );
}

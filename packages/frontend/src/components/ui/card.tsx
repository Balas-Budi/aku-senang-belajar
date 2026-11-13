import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'border-paper-edge bg-background rounded-[20px] border p-5 shadow-[0_1px_2px_rgb(28_22_96/0.05),0_8px_24px_-12px_rgb(28_22_96/0.12)] sm:p-6',
                className,
            )}
            {...props}
        />
    );
}

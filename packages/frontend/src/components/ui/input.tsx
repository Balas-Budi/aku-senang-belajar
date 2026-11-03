import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
export function Input({ className, ...props }: ComponentProps<'input'>) {
    return (
        <input
            className={cn(
                'border-border bg-background focus-visible:outline-ring aria-invalid:border-destructive min-h-12 w-full rounded-lg border px-3 py-2 focus-visible:outline-3 focus-visible:outline-offset-2',
                className,
            )}
            {...props}
        />
    );
}

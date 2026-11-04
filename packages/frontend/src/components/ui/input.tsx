import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
export const inputVariants = cva(
    'border-border bg-background focus-visible:outline-ring aria-invalid:border-destructive w-full focus-visible:outline-3 focus-visible:outline-offset-2',
    {
        variants: {
            feel: {
                flat: 'min-h-12 rounded-lg border px-3 py-2',
                chunky: 'min-h-14 rounded-2xl border-2 px-4 py-2 text-lg',
            },
        },
        defaultVariants: { feel: 'flat' },
    },
);
export function Input({
    className,
    feel,
    ...props
}: ComponentProps<'input'> & VariantProps<typeof inputVariants>) {
    return (
        <input className={cn(inputVariants({ feel }), className)} {...props} />
    );
}

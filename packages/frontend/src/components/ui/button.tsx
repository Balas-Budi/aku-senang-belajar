import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';
export const buttonVariants = cva(
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-2 font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:opacity-60',
    {
        variants: {
            variant: {
                primary:
                    'bg-primary text-primary-foreground hover:bg-primary-deep',
                outline: 'border border-border bg-background hover:bg-muted',
                destructive:
                    'bg-destructive text-primary-foreground hover:bg-destructive/90',
            },
        },
        defaultVariants: { variant: 'primary' },
    },
);
export function Button({
    className,
    variant,
    type = 'button',
    ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
    return (
        <button
            type={type}
            className={cn(buttonVariants({ variant }), className)}
            {...props}
        />
    );
}

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
            feel: {
                flat: '',
                chunky: 'font-display min-h-14 rounded-2xl px-6 text-lg tracking-wide transition-[translate,box-shadow,background-color] duration-100 active:translate-y-1 active:shadow-none disabled:translate-y-0',
            },
        },
        compoundVariants: [
            {
                variant: 'primary',
                feel: 'chunky',
                className:
                    'hover:bg-primary shadow-[0_4px_0_var(--color-primary-shade)] hover:brightness-110',
            },
            {
                variant: 'outline',
                feel: 'chunky',
                className:
                    'text-primary-deep hover:bg-student-surface border-2 bg-white shadow-[0_4px_0_var(--color-border)]',
            },
            {
                variant: 'destructive',
                feel: 'chunky',
                className:
                    'hover:bg-destructive shadow-[0_4px_0_var(--color-destructive-shade)] hover:brightness-110',
            },
        ],
        defaultVariants: { variant: 'primary', feel: 'flat' },
    },
);
export function Button({
    className,
    variant,
    feel,
    type = 'button',
    ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
    return (
        <button
            type={type}
            className={cn(buttonVariants({ variant, feel }), className)}
            {...props}
        />
    );
}

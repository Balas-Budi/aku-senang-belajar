import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export const alertVariants = cva('rounded-lg border-l-4 px-4 py-3', {
    variants: {
        tone: {
            info: 'border-primary bg-secondary text-primary-deep',
            attention:
                'border-status-verify bg-status-verify-soft text-status-verify',
        },
    },
    defaultVariants: { tone: 'info' },
});

export function Alert({
    className,
    tone,
    ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
    return (
        <div className={cn(alertVariants({ tone }), className)} {...props} />
    );
}

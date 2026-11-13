import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

export function Table({ className, ...props }: ComponentProps<'table'>) {
    return (
        <table
            className={cn('w-full text-left text-base', className)}
            {...props}
        />
    );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
    return (
        <thead
            className={cn('bg-muted text-muted-foreground', className)}
            {...props}
        />
    );
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
    return (
        <tr
            className={cn(
                'border-paper-edge hover:bg-muted group border-b last:border-b-0',
                className,
            )}
            {...props}
        />
    );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
    return (
        <th
            className={cn('px-4 py-3 text-left font-semibold', className)}
            {...props}
        />
    );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
    return <td className={cn('px-4 py-3 align-top', className)} {...props} />;
}

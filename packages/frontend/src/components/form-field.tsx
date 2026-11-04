import type { ComponentProps, ReactNode } from 'react';
import { Input } from './ui/input';
import { ApiError } from '../lib/api';
import { fieldMessage } from '../lib/field-message';
export function FormField({
    label,
    error,
    name,
    trailing,
    ...props
}: ComponentProps<'input'> & {
    name: string;
    label: string;
    error?: unknown;
    trailing?: ReactNode;
}) {
    const messages =
        error instanceof ApiError
            ? error.body.details?.filter((item) => item.field === name)
            : [];
    return (
        <div className="space-y-2">
            <label htmlFor={name} className="block font-medium">
                {label}
            </label>
            <div className="relative">
                <Input
                    id={name}
                    name={name}
                    aria-invalid={Boolean(messages?.length)}
                    aria-describedby={
                        messages?.length ? `${name}-error` : undefined
                    }
                    {...props}
                />
                {trailing}
            </div>
            {Boolean(messages?.length) && (
                <p id={`${name}-error`} className="text-destructive">
                    {messages
                        ?.map((item) => fieldMessage(item.message))
                        .join(' ')}
                </p>
            )}
        </div>
    );
}

import type { ComponentProps, ReactNode } from 'react';
import { Input } from './ui/input';
import { ApiError } from '../lib/api';
import { fieldMessage } from '../lib/field-message';
export function fieldErrorText(error: unknown, name: string) {
    const messages =
        error instanceof ApiError
            ? (error.body.details ?? [])
                  .filter((item) => item.field === name)
                  .map((item) => fieldMessage(item.message))
            : [];
    return messages.length > 0 ? messages.join(' ') : null;
}
export function FormField({
    label,
    error,
    name,
    trailing,
    ...props
}: ComponentProps<typeof Input> & {
    name: string;
    label: string;
    error?: unknown;
    trailing?: ReactNode;
}) {
    const message = fieldErrorText(error, name);
    return (
        <div className="space-y-2">
            <label htmlFor={name} className="block font-medium">
                {label}
            </label>
            <div className="relative">
                <Input
                    id={name}
                    name={name}
                    aria-invalid={message !== null}
                    aria-describedby={message ? `${name}-error` : undefined}
                    {...props}
                />
                {trailing}
            </div>
            {message && (
                <p id={`${name}-error`} className="text-destructive">
                    {message}
                </p>
            )}
        </div>
    );
}

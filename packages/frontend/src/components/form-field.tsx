import type { ComponentProps, ReactNode } from 'react';
import { Input, inputVariants } from './ui/input';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { fieldMessage } from '../lib/field-message';
export function fieldErrorText(error: unknown, name: string) {
    const messages =
        error instanceof ApiError
            ? (error.body.details ?? [])
                  .filter((item) => item.field === name)
                  .map((item) => fieldMessage(item.message, item.field))
            : [];
    return messages.length > 0 ? messages.join(' ') : null;
}
export function FormField({
    label,
    error,
    name,
    id = name,
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
            <label htmlFor={id} className="block font-medium">
                {label}
            </label>
            <div className="relative">
                <Input
                    id={id}
                    name={name}
                    aria-invalid={message !== null}
                    aria-describedby={message ? `${id}-error` : undefined}
                    {...props}
                />
                {trailing}
            </div>
            {message && (
                <p id={`${id}-error`} className="text-destructive">
                    {message}
                </p>
            )}
        </div>
    );
}
export function TextAreaField({
    label,
    hint,
    error,
    name,
    id = name,
    className,
    ...props
}: ComponentProps<'textarea'> & {
    name: string;
    label: string;
    hint?: string;
    error?: unknown;
}) {
    const message = fieldErrorText(error, name);
    const described = [hint && `${id}-hint`, message && `${id}-error`]
        .filter(Boolean)
        .join(' ');
    return (
        <div className="space-y-2">
            <label htmlFor={id} className="block font-medium">
                {label}
            </label>
            {hint && (
                <p id={`${id}-hint`} className="text-muted-foreground text-sm">
                    {hint}
                </p>
            )}
            <textarea
                id={id}
                name={name}
                aria-invalid={message !== null}
                aria-describedby={described || undefined}
                className={cn(inputVariants(), 'min-h-20 py-2', className)}
                {...props}
            />
            {message && (
                <p id={`${id}-error`} className="text-destructive">
                    {message}
                </p>
            )}
        </div>
    );
}

import { useEffect, useState, type RefObject } from 'react';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { fieldMessage } from '../../lib/field-message';
// shortcut: mirrors INVITE_CODE_LENGTH and normalizeCode in the backend; import both from the shared schema package once it exists
const codeLength = 6;
export function inviteCodeMessages(error: unknown) {
    return error instanceof ApiError
        ? (error.body.details ?? [])
              .filter((item) => item.field === 'inviteCode')
              .map((item) => fieldMessage(item.message))
        : [];
}
export function ClassCodeField({
    error,
    slotsRef,
    onFocusChange,
    onComplete,
    onEdit,
}: {
    error: unknown;
    slotsRef: RefObject<HTMLDivElement | null>;
    onFocusChange: (focused: boolean) => void;
    onComplete: () => void;
    onEdit: () => void;
}) {
    const [code, setCode] = useState('');
    const [focused, setFocused] = useState(false);
    const invalid = inviteCodeMessages(error).length > 0;
    useEffect(() => {
        if (!invalid || matchMedia('(prefers-reduced-motion: reduce)').matches)
            return;
        slotsRef.current?.animate(
            [
                { transform: 'translateX(0)' },
                { transform: 'translateX(-6px)' },
                { transform: 'translateX(5px)' },
                { transform: 'translateX(-3px)' },
                { transform: 'translateX(0)' },
            ],
            { duration: 320, easing: 'ease-out' },
        );
    }, [error, invalid, slotsRef]);
    return (
        <div className="space-y-2">
            <label
                htmlFor="inviteCode"
                className="font-display text-primary-deep block text-lg font-semibold"
            >
                Kode kelas
            </label>
            <div
                ref={slotsRef}
                className="relative grid max-w-sm grid-cols-6 gap-1.5 sm:gap-2"
            >
                <input
                    id="inviteCode"
                    name="inviteCode"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    aria-invalid={invalid}
                    aria-describedby="inviteCode-hint"
                    onInput={(event) => {
                        onEdit();
                        const value = event.currentTarget.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, '')
                            .slice(0, codeLength);
                        event.currentTarget.value = value;
                        if (
                            value.length === codeLength &&
                            code.length < codeLength
                        )
                            onComplete();
                        setCode(value);
                    }}
                    onFocus={() => {
                        setFocused(true);
                        onFocusChange(true);
                    }}
                    onBlur={() => {
                        setFocused(false);
                        onFocusChange(false);
                    }}
                    className="absolute inset-0 z-10 size-full cursor-text opacity-0"
                />
                {Array.from({ length: codeLength }, (_, index) => {
                    const character = code[index];
                    const active =
                        focused &&
                        index === Math.min(code.length, codeLength - 1);
                    return (
                        <span
                            key={index}
                            aria-hidden="true"
                            className={cn(
                                'font-display text-primary-deep flex h-16 items-center justify-center rounded-2xl border-2 border-b-[5px] text-3xl font-semibold transition-colors duration-150',
                                character
                                    ? 'border-primary bg-student-surface'
                                    : 'border-border bg-white',
                                active && 'border-primary ring-ring/30 ring-4',
                                invalid && 'border-destructive',
                            )}
                        >
                            {character ? (
                                <span
                                    key={character}
                                    className="code-character"
                                >
                                    {character}
                                </span>
                            ) : (
                                active && (
                                    <span className="code-caret bg-primary h-7 w-0.5 rounded-full" />
                                )
                            )}
                        </span>
                    );
                })}
            </div>
            <p id="inviteCode-hint" className="text-muted-foreground text-base">
                {invalid
                    ? 'Periksa lagi kodenya, lalu coba lagi.'
                    : code.length === 0
                      ? `Isi ${codeLength} huruf atau angka.`
                      : code.length < codeLength
                        ? `Kurang ${codeLength - code.length} lagi.`
                        : 'Kodenya lengkap. Tekan Gabung ke kelas.'}
            </p>
        </div>
    );
}

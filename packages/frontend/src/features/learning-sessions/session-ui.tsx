import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    type ComponentProps,
} from 'react';
import { CheckIcon } from '../../components/icons/check-icon';
import { JalakBali, useJalakMotion } from '../../components/jalak-bali';
import { requestErrorMessage } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { inputVariants } from '../../components/ui/input';
import { useErrorToast } from '../../components/ui/toast';
import { cn } from '../../lib/cn';
import { VoiceAnswer } from '../voice/voice-answer';
import { Illustration } from './illustration';
import {
    liveRefusal,
    type Attempt,
    type Block,
    type BlockOf,
    type Option,
} from './queries';

export type BlockProps<Kind extends Block['kind']> = {
    assignmentId: number;
    attempt: Attempt;
    block: BlockOf<Kind>;
    teacher: string;
    onNext: () => void;
};

export function useActionError() {
    const showError = useErrorToast();
    return useCallback(
        (error: unknown) => {
            if (!liveRefusal(error)) showError(requestErrorMessage(error));
        },
        [showError],
    );
}

export const WaitContext = createContext(false);

export function NextButton(props: ComponentProps<typeof Button>) {
    const waiting = useContext(WaitContext);
    const note = useRef<HTMLParagraphElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const waited = useRef(false);

    useEffect(() => {
        if (
            (waiting || waited.current) &&
            document.activeElement === document.body
        )
            (waiting ? note : button).current?.focus({ preventScroll: true });
        waited.current = waiting;
    }, [waiting]);

    return waiting ? (
        <p
            ref={note}
            role="status"
            tabIndex={-1}
            className="bg-student-surface text-primary-deep focus-visible:outline-ring rounded-2xl px-4 py-3 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2"
        >
            Tunggu gurumu membuka langkah berikutnya, ya.
        </p>
    ) : (
        <Button ref={button} feel="chunky" {...props} />
    );
}

export function ScreenCard({ className, ...props }: ComponentProps<'section'>) {
    return (
        <section
            className={cn(
                'border-paper-edge space-y-5 rounded-3xl border-2 border-b-[6px] bg-white p-5 sm:p-8',
                className,
            )}
            {...props}
        />
    );
}

export function ScreenHeading({ className, ...props }: ComponentProps<'h1'>) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => heading.current?.focus(), []);
    return (
        <h1
            ref={heading}
            tabIndex={-1}
            className={cn(
                'font-display text-primary-deep focus-visible:outline-ring text-[1.5em] leading-tight font-semibold focus-visible:outline-3 focus-visible:outline-offset-4',
                className,
            )}
            {...props}
        />
    );
}

export function OptionPicker({
    name,
    legend,
    options,
    value,
    onChange,
    disabled = false,
    correct = null,
    reading = null,
}: {
    name: string;
    legend: string;
    options: Option[];
    value: string | null;
    onChange: (id: string) => void;
    disabled?: boolean;
    correct?: string | null;
    reading?: string | null;
}) {
    const pictures = options.some((option) => option.illustration);
    return (
        <fieldset disabled={disabled}>
            <legend className="sr-only">{legend}</legend>
            <div
                className={cn(
                    'grid gap-3',
                    pictures ? 'grid-cols-3' : 'sm:grid-cols-2',
                )}
            >
                {options.map((option) => (
                    <label
                        key={option.id}
                        className={cn(
                            'border-border text-primary-deep has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-ring flex min-h-14 cursor-pointer gap-2 rounded-2xl border-2 border-b-[5px] bg-white p-3 font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-disabled:cursor-default',
                            pictures
                                ? 'flex-col items-center text-center'
                                : 'flex-wrap items-center px-4',
                            correct === option.id &&
                                'border-primary-deep bg-activity-green/15 has-checked:bg-activity-green/15',
                            reading === option.id &&
                                'ring-activity-orange/50 ring-4',
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.id}
                            checked={value === option.id}
                            onChange={() => onChange(option.id)}
                            className="sr-only"
                        />
                        {option.illustration && (
                            <Illustration name={option.illustration} />
                        )}
                        <span className="font-display">{option.label}</span>
                        {correct === option.id && (
                            <span
                                className={cn(
                                    'text-primary-deep flex w-full items-center gap-1 text-[0.85em] font-bold',
                                    pictures && 'justify-center',
                                )}
                            >
                                <CheckIcon className="size-[1.1em]" />
                                Yang tepat
                            </span>
                        )}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export function ReasonField({
    id,
    label,
    starters = [],
    placeholder,
    value,
    onChange,
    disabled = false,
}: {
    id: string;
    label: string;
    starters?: string[];
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const field = useRef<HTMLTextAreaElement>(null);
    function begin(starter: string) {
        const start = starter.replace(/\s*\.{3}$/, ' ');
        const next = value.trim() ? `${value.trimEnd()} ${start}` : start;
        onChange(next);
        requestAnimationFrame(() => {
            field.current?.focus();
            field.current?.setSelectionRange(next.length, next.length);
        });
    }
    return (
        <div className="space-y-2">
            <label
                htmlFor={id}
                className="font-display text-primary-deep block text-[1.1em] font-semibold"
            >
                {label}
            </label>
            {starters.length > 0 && !disabled && (
                <div className="flex flex-wrap gap-2">
                    {starters.map((starter) => (
                        <button
                            key={starter}
                            type="button"
                            onClick={() => begin(starter)}
                            className="border-border text-primary-deep hover:bg-student-surface focus-visible:outline-ring min-h-12 rounded-full border-2 bg-white px-4 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2"
                        >
                            {starter}
                        </button>
                    ))}
                </div>
            )}
            <textarea
                ref={field}
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                rows={3}
                maxLength={500}
                className={cn(
                    inputVariants({ feel: 'chunky' }),
                    'placeholder:text-muted-foreground min-h-28 resize-y py-3 text-[1em] leading-relaxed disabled:bg-white',
                )}
            />
            {!disabled && (
                <VoiceAnswer
                    fieldId={id}
                    value={value}
                    maxLength={500}
                    onChange={onChange}
                />
            )}
        </div>
    );
}

export function OfflineNote({ onRetry }: { onRetry?: () => void }) {
    return (
        <div className="bg-student-accent-soft flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <p role="status" className="text-student-accent-ink flex-1">
                {onRetry
                    ? 'Jawabanmu belum terkirim. Periksa sinyal, lalu kirim lagi.'
                    : 'Sinyal sedang putus. Jawabanmu terkirim otomatis begitu sinyal kembali.'}
            </p>
            {onRetry && (
                <Button feel="chunky" variant="outline" onClick={onRetry}>
                    Kirim lagi
                </Button>
            )}
        </div>
    );
}

export function ReactingJalak({
    cheers,
    chirps,
    className,
}: {
    cheers: number;
    chirps: number;
    className?: string;
}) {
    const figure = useRef<SVGSVGElement>(null);
    useJalakMotion(figure, { cheers, chirps });
    return (
        <JalakBali ref={figure} className={cn('w-20 shrink-0', className)} />
    );
}

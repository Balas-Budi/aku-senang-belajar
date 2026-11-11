import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { CheckIcon } from '../../components/icons/check-icon';
import { cn } from '../../lib/cn';
import { wedge } from './diagram';
import type { Activity, ActivityItem, BlockOf, Earned } from './queries';
import { OptionPicker } from './session-ui';

type CheckContent = BlockOf<'check'>['content'];
type Placing = Exclude<Activity, { type: 'shade' }>;
type Shading = Extract<Activity, { type: 'shade' }>;
type Placed = Record<string, string>;
type InputProps<Kind extends Activity> = {
    activity: Kind;
    value: string | null;
    onChange: (value: string | null) => void;
    disabled: boolean;
    correct: boolean;
};

const focusRing =
    'focus-visible:outline-ring focus-visible:outline-3 focus-visible:outline-offset-2';

const placesOf = (activity: Placing): ActivityItem[] =>
    activity.type === 'order'
        ? activity.cards.map((_, index) => ({
              id: String(index + 1),
              label: String(index + 1),
          }))
        : activity.places;

function placedFrom(activity: Placing, value: string | null) {
    const placed: Placed = {};
    if (!value) return placed;
    const cards = new Set(activity.cards.map(({ id }) => id));
    const places = new Set(placesOf(activity).map(({ id }) => id));
    const pairs =
        activity.type === 'order'
            ? value.split(',').map((card, index) => [card, String(index + 1)])
            : value.split(',').map((pair) => pair.split(':'));
    for (const [card, place] of pairs)
        if (card && place && cards.has(card) && places.has(place))
            placed[card] = place;
    return placed;
}

function choiceOf(activity: Placing, placed: Placed) {
    const ids = activity.cards.map(({ id }) => id);
    if (ids.some((id) => !placed[id])) return null;
    return activity.type === 'order'
        ? ids.sort((a, b) => Number(placed[a]) - Number(placed[b])).join(',')
        : ids
              .sort()
              .map((id) => `${id}:${placed[id]}`)
              .join(',');
}

function PlacingInput({
    activity,
    value,
    onChange,
    disabled,
    correct,
}: InputProps<Placing>) {
    const [placed, setPlaced] = useState(() => placedFrom(activity, value));
    const [picked, setPicked] = useState<string | null>(null);
    const [status, setStatus] = useState('');
    const [drag, setDrag] = useState<{
        card: string;
        x: number;
        y: number;
        over: string | null;
    } | null>(null);
    const root = useRef<HTMLDivElement>(null);
    const refocus = useRef<string | null>(null);
    const origin = useRef<{ card: string; x: number; y: number } | null>(null);
    const moving = useRef(false);
    const swallowClick = useRef(false);
    const trayId = useId();
    const order = activity.type === 'order';
    const single = activity.type !== 'group';
    const places = placesOf(activity);
    const shown = disabled && value ? placedFrom(activity, value) : placed;
    const tray = activity.cards.filter(({ id }) => !shown[id]);
    const List = order ? 'ol' : 'ul';

    useEffect(() => {
        if (!refocus.current) return;
        root.current
            ?.querySelector<HTMLElement>(
                `[data-place="${refocus.current}"] > button`,
            )
            ?.focus();
        refocus.current = null;
    }, [placed]);

    const labelOf = (card: string) =>
        activity.cards.find(({ id }) => id === card)?.label ?? card;
    const nameOf = (place: ActivityItem) =>
        order ? `tempat ${place.label}` : place.label;

    function update(next: Placed, message: string) {
        setPlaced(next);
        setPicked(null);
        setStatus(message);
        onChange(choiceOf(activity, next));
    }

    function put(card: string, place: ActivityItem) {
        const next = { ...placed };
        const moved = single
            ? Object.keys(next).filter(
                  (other) => other !== card && next[other] === place.id,
              )
            : [];
        for (const other of moved) delete next[other];
        next[card] = place.id;
        update(
            next,
            [
                `${labelOf(card)} ditaruh di ${nameOf(place)}.`,
                ...moved.map((other) => `${labelOf(other)} kembali ke kartu.`),
            ].join(' '),
        );
    }

    function takeBack(card: string) {
        const next = { ...placed };
        delete next[card];
        update(next, `${labelOf(card)} kembali ke kartu.`);
    }

    function choose(place: ActivityItem) {
        if (picked) put(picked, place);
        else setStatus('Ketuk kartu dulu, lalu ketuk tempatnya.');
    }

    function press(card: ActivityItem, place?: ActivityItem) {
        if (swallowClick.current) {
            swallowClick.current = false;
            return;
        }
        if (!place) {
            const next = picked === card.id ? null : card.id;
            setPicked(next);
            setStatus(
                next ? `${card.label} dipilih. Sekarang ketuk tempatnya.` : '',
            );
            return;
        }
        if (!picked || single) refocus.current = place.id;
        if (picked) put(picked, place);
        else takeBack(card.id);
    }

    function targetAt(event: PointerEvent<HTMLButtonElement>) {
        const target = document
            .elementsFromPoint(event.clientX, event.clientY)
            .find((element) => !event.currentTarget.contains(element))
            ?.closest<HTMLElement>('[data-place], [data-tray]');
        return target && root.current?.contains(target) ? target : null;
    }

    function stopDrag() {
        origin.current = null;
        moving.current = false;
        setDrag(null);
    }

    const dragging = (card: string) => ({
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
            if (disabled || event.pointerType !== 'mouse' || event.button !== 0)
                return;
            event.currentTarget.setPointerCapture(event.pointerId);
            origin.current = { card, x: event.clientX, y: event.clientY };
        },
        onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
            const start = origin.current;
            if (start?.card !== card) return;
            const x = event.clientX - start.x;
            const y = event.clientY - start.y;
            if (!moving.current && Math.hypot(x, y) < 8) return;
            moving.current = true;
            setDrag({
                card,
                x,
                y,
                over: targetAt(event)?.dataset.place ?? null,
            });
        },
        onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
            if (!moving.current) {
                origin.current = null;
                return;
            }
            const target = targetAt(event);
            stopDrag();
            swallowClick.current = true;
            setTimeout(() => {
                swallowClick.current = false;
            });
            const place = places.find(({ id }) => id === target?.dataset.place);
            if (place && placed[card] !== place.id) put(card, place);
            else if (target && !place && placed[card]) takeBack(card);
        },
        onPointerCancel: stopDrag,
        onLostPointerCapture: stopDrag,
    });

    const cardButton = (card: ActivityItem, place?: ActivityItem) => (
        <button
            key={card.id}
            type="button"
            aria-pressed={place ? undefined : picked === card.id}
            onClick={() => press(card, place)}
            {...dragging(card.id)}
            style={
                drag?.card === card.id
                    ? { transform: `translate(${drag.x}px, ${drag.y}px)` }
                    : undefined
            }
            className={cn(
                'border-border text-primary-deep font-display aria-pressed:border-primary aria-pressed:bg-secondary min-h-12 max-w-full cursor-pointer touch-manipulation rounded-2xl border-2 border-b-[5px] bg-white px-4 py-2 text-left font-semibold wrap-anywhere select-none disabled:cursor-default',
                focusRing,
                drag?.card === card.id &&
                    'relative z-10 cursor-grabbing shadow-lg',
            )}
        >
            {card.label}
            {place && (
                <span className="sr-only">
                    , di {nameOf(place)}
                    {!disabled && '. Ketuk untuk mengambilnya lagi.'}
                </span>
            )}
        </button>
    );

    return (
        <div ref={root} className="space-y-3">
            {!disabled && (
                <>
                    <p className="text-muted-foreground">
                        Ketuk kartu, lalu ketuk tempatnya.
                    </p>
                    <div
                        data-tray
                        className="bg-student-surface space-y-2 rounded-2xl p-3"
                    >
                        <p id={trayId} className="text-primary-deep font-bold">
                            Kartu
                        </p>
                        {tray.length > 0 ? (
                            <ul
                                aria-labelledby={trayId}
                                className="flex flex-wrap gap-2"
                            >
                                {tray.map((card) => (
                                    <li key={card.id} className="max-w-full">
                                        {cardButton(card)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground flex min-h-12 items-center">
                                Semua kartu sudah ditaruh.
                            </p>
                        )}
                    </div>
                </>
            )}
            <List className={cn('grid gap-3', !order && 'sm:grid-cols-2')}>
                {places.map((place) => {
                    const inside = activity.cards.filter(
                        ({ id }) => shown[id] === place.id,
                    );
                    return (
                        <li
                            key={place.id}
                            data-place={place.id}
                            onClick={(event) => {
                                if (
                                    !disabled &&
                                    !swallowClick.current &&
                                    event.target instanceof Element &&
                                    !event.target.closest('button')
                                )
                                    choose(place);
                            }}
                            className={cn(
                                'border-border flex min-w-0 gap-2 rounded-2xl border-2 bg-white p-2',
                                order ? 'items-center' : 'flex-col',
                                inside.length === 0 && 'border-dashed',
                                !disabled &&
                                    (picked || drag) &&
                                    'border-primary',
                                drag?.over === place.id && 'bg-secondary',
                                correct &&
                                    'border-primary-deep bg-activity-green/15',
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => choose(place)}
                                className={cn(
                                    'bg-secondary text-primary-deep font-display min-h-12 shrink-0 cursor-pointer touch-manipulation rounded-xl px-3 py-2 font-semibold wrap-anywhere disabled:cursor-default',
                                    focusRing,
                                    order
                                        ? 'min-w-12 text-center'
                                        : 'w-full text-left',
                                )}
                            >
                                {order && (
                                    <span className="sr-only">Tempat </span>
                                )}
                                {place.label}
                                <span className="sr-only">
                                    ,{' '}
                                    {inside.length > 0
                                        ? `berisi ${inside.map(({ label }) => label).join(', ')}`
                                        : 'kosong'}
                                </span>
                            </button>
                            <div
                                className={cn(
                                    'flex min-h-12 flex-wrap gap-2',
                                    order && 'min-w-0 flex-1',
                                )}
                            >
                                {inside.map((card) => cardButton(card, place))}
                            </div>
                        </li>
                    );
                })}
            </List>
            {!disabled && (
                <p
                    role="status"
                    className="text-muted-foreground min-h-[1.5em]"
                >
                    {status}
                </p>
            )}
        </div>
    );
}

const firstParts = (parts: number, count: number) =>
    Array.from({ length: parts }, (_, index) => index < count);

function ShadeInput({
    activity: { shape, parts },
    value,
    onChange,
    disabled,
}: InputProps<Shading>) {
    const [shaded, setShaded] = useState(() =>
        firstParts(parts, Number(value ?? 0)),
    );
    const [focused, setFocused] = useState<number | null>(null);
    const own = shaded.filter(Boolean).length;
    const shown =
        disabled && value !== null && own !== Number(value)
            ? firstParts(parts, Number(value))
            : shaded;
    const count = shown.filter(Boolean).length;
    const partName = (index: number) => `Bagian ${index + 1} dari ${parts}`;

    function toggle(index: number) {
        if (disabled) return;
        const next = shaded.map((on, at) => (at === index ? !on : on));
        const amount = next.filter(Boolean).length;
        setShaded(next);
        onChange(amount > 0 ? String(amount) : null);
    }

    return (
        <div className="space-y-3">
            {!disabled && (
                <p className="text-muted-foreground">
                    Ketuk bagian yang mau kamu arsir.
                </p>
            )}
            {shape === 'bar' ? (
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: `repeat(${parts}, minmax(0, 1fr))`,
                    }}
                >
                    {shown.map((on, index) => (
                        <button
                            key={index}
                            type="button"
                            aria-pressed={on}
                            aria-label={partName(index)}
                            onClick={() => toggle(index)}
                            className={cn(
                                'border-primary-deep relative -ml-0.5 min-h-16 cursor-pointer touch-manipulation border-2 first:ml-0 first:rounded-l-xl last:rounded-r-xl focus-visible:z-10 disabled:cursor-default',
                                focusRing,
                                on ? 'bg-activity-pink' : 'bg-white',
                            )}
                        />
                    ))}
                </div>
            ) : (
                <svg
                    viewBox="-4 -4 128 128"
                    role="group"
                    aria-label={`Lingkaran dibagi ${parts} bagian`}
                    className="mx-auto w-full max-w-72"
                >
                    {shown.map((on, index) => (
                        <path
                            key={index}
                            d={wedge(60, 60, 58, parts, index)}
                            role="button"
                            tabIndex={disabled ? -1 : 0}
                            aria-disabled={disabled || undefined}
                            aria-pressed={on}
                            aria-label={partName(index)}
                            onClick={() => toggle(index)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ')
                                    return;
                                event.preventDefault();
                                toggle(index);
                            }}
                            onFocus={(event) => {
                                if (
                                    event.currentTarget.matches(
                                        ':focus-visible',
                                    )
                                )
                                    setFocused(index);
                            }}
                            onBlur={() => setFocused(null)}
                            strokeWidth={2.5}
                            strokeLinejoin="round"
                            className={cn(
                                'stroke-primary-deep outline-none',
                                on ? 'fill-activity-pink' : 'fill-white',
                                !disabled && 'cursor-pointer',
                            )}
                        />
                    ))}
                    {focused !== null && (
                        <g
                            fill="none"
                            strokeLinejoin="round"
                            pointerEvents="none"
                        >
                            <path
                                d={wedge(60, 60, 58, parts, focused)}
                                strokeWidth={7}
                                className="stroke-white"
                            />
                            <path
                                d={wedge(60, 60, 58, parts, focused)}
                                strokeWidth={4}
                                className="stroke-ring"
                            />
                        </g>
                    )}
                </svg>
            )}
            <p role="status" className="sr-only">
                {count} dari {parts} bagian diarsir.
            </p>
        </div>
    );
}

export function ActivityInput({
    activity,
    legend,
    value,
    onChange,
    disabled = false,
    correct = false,
}: {
    activity: Activity;
    legend: string;
    value: string | null;
    onChange: (value: string | null) => void;
    disabled?: boolean;
    correct?: boolean;
}) {
    const shared = { value, onChange, disabled, correct };
    return (
        <fieldset disabled={disabled} className="min-w-0">
            <legend className="sr-only">{legend}</legend>
            <div className="space-y-3">
                {activity.type === 'shade' ? (
                    <ShadeInput activity={activity} {...shared} />
                ) : (
                    <PlacingInput activity={activity} {...shared} />
                )}
                {correct && (
                    <p className="text-primary-deep flex items-center gap-1 text-[0.85em] font-bold">
                        <CheckIcon className="size-[1.1em]" />
                        Yang tepat
                    </p>
                )}
            </div>
        </fieldset>
    );
}

export function answerLabels({ options, activity }: CheckContent) {
    const items: { label: string }[] = !activity
        ? (options ?? [])
        : activity.type === 'shade'
          ? []
          : [
                ...activity.cards,
                ...(activity.type === 'order' ? [] : activity.places),
            ];
    return items.map(({ label }) => label);
}

export const answerMissing = ({ activity }: CheckContent) =>
    !activity
        ? 'Pilih satu jawaban dulu.'
        : activity.type === 'shade'
          ? 'Arsir dulu bagiannya, ya.'
          : 'Taruh semua kartu dulu, ya.';

export const inPlaceNote = (
    { activity }: CheckContent,
    inPlace: number | null,
) =>
    inPlace !== null && activity && activity.type !== 'shade'
        ? `${inPlace} dari ${activity.cards.length} sudah di tempatnya.`
        : undefined;

export function CheckAnswer({
    name,
    content,
    earned,
    choice,
    onChange,
    reading,
}: {
    name: string;
    content: CheckContent;
    earned: Earned;
    choice: string | null;
    onChange: (choice: string | null) => void;
    reading: string | null;
}) {
    const closed = earned.praise !== null || earned.reveal !== null;
    if (content.activity)
        return (
            <ActivityInput
                activity={content.activity}
                legend={content.prompt}
                value={earned.reveal?.answer ?? choice}
                onChange={onChange}
                disabled={closed}
                correct={closed}
            />
        );
    return (
        <OptionPicker
            name={name}
            legend={content.prompt}
            options={content.options ?? []}
            value={choice}
            onChange={onChange}
            disabled={closed}
            correct={earned.reveal?.answer ?? (earned.praise ? choice : null)}
            reading={reading}
        />
    );
}

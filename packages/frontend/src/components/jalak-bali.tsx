import {
    useEffect,
    useId,
    useRef,
    useState,
    type Ref,
    type RefObject,
} from 'react';
import { cn } from '../lib/cn';
import {
    asleepPose,
    awakePose,
    cheerPose,
    cheerSeconds,
    chirpPose,
    chirpSeconds,
    coverPose,
    jalakChannels,
    perchedGreeting,
    perchedGreetingSeconds,
    settle,
    standingGreeting,
    standingGreetingSeconds,
    type JalakPose,
} from '../lib/jalak-motion';
const rightWing =
    'M172 128C192 136 206 160 202 190C200 206 190 216 182 210C174 202 168 176 166 150C166 140 168 132 172 128Z';
const leftWing =
    'M68 128C48 136 34 160 38 190C40 206 50 216 58 210C66 202 72 176 74 150C74 140 72 132 68 128Z';
const tail =
    'M106 212C100 230 90 244 80 252C88 258 98 256 103 249C110 240 115 228 118 214ZM114 214C113 232 113 246 115 256C119 260 125 260 127 256C128 246 128 232 126 214ZM134 212C140 230 150 244 160 252C152 258 142 256 137 249C130 240 125 228 122 214Z';
const cssName = (channel: string) =>
    `--jalak-${channel.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
export function useJalakMotion(
    figure: RefObject<SVGSVGElement | null>,
    {
        perched = false,
        watching = false,
        lookAt,
        covering = false,
        cheers = 0,
        chirps = 0,
    }: {
        perched?: boolean;
        watching?: boolean;
        lookAt?: RefObject<HTMLElement | null>;
        covering?: boolean;
        cheers?: number;
        chirps?: number;
    },
) {
    const signals = useRef({
        watching,
        lookAt,
        covering,
        cheerAt: -Infinity,
        chirpAt: -Infinity,
        wake: () => {},
    });
    const [ready, setReady] = useState(false);
    useEffect(() => {
        signals.current.watching = watching;
        signals.current.lookAt = lookAt;
        signals.current.covering = covering;
        signals.current.wake();
    }, [watching, lookAt, covering]);
    useEffect(() => {
        if (!cheers) return;
        signals.current.cheerAt = performance.now();
        signals.current.wake();
    }, [cheers]);
    useEffect(() => {
        if (!chirps) return;
        signals.current.chirpAt = performance.now();
        signals.current.wake();
    }, [chirps]);
    useEffect(() => {
        const element = figure.current;
        if (!element) return;
        const svg: SVGSVGElement = element;
        const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
        const greeting = perched ? perchedGreeting : standingGreeting;
        const greetingMs =
            1000 * (perched ? perchedGreetingSeconds : standingGreetingSeconds);
        const rest = perched ? asleepPose : awakePose;
        const started = performance.now();
        const pose = greeting(0);
        const velocity: JalakPose = { ...rest };
        for (const key of jalakChannels) velocity[key] = 0;
        const gaze = { turn: 0, lookX: 0, lookY: 0 };
        let previous = started;
        let lastMove = -Infinity;
        let frame = 0;
        function draw() {
            for (const key of jalakChannels)
                svg.style.setProperty(cssName(key), String(pose[key]));
        }
        function aim(x: number, y: number) {
            const bounds = svg.getBoundingClientRect();
            const dx = x - bounds.left - bounds.width / 2;
            const dy = y - bounds.top - (bounds.height * 94) / 256;
            const distance = Math.max(Math.hypot(dx, dy), 1);
            const reach = Math.min(1, distance / 160) / distance;
            gaze.lookX = dx * reach;
            gaze.lookY = dy * reach;
            gaze.turn = gaze.lookX * 6;
        }
        function tick(now: number) {
            const seconds = Math.min((now - previous) / 1000, 0.05);
            previous = now;
            let moving = true;
            if (now - started < greetingMs) {
                const next = greeting((now - started) / 1000);
                for (const key of jalakChannels) {
                    velocity[key] =
                        seconds > 0 ? (next[key] - pose[key]) / seconds : 0;
                    pose[key] = next[key];
                }
            } else {
                const { watching, lookAt, covering, cheerAt, chirpAt } =
                    signals.current;
                const watched = watching ? lookAt?.current : null;
                if (watched) {
                    const box = watched.getBoundingClientRect();
                    aim(box.left + box.width / 2, box.top + box.height / 2);
                }
                const following =
                    Boolean(watched) ||
                    (finePointer.matches && now - lastMove < 1500);
                const cheering = now - cheerAt < cheerSeconds * 1000;
                const chirping = now - chirpAt < chirpSeconds * 1000;
                const alert = following || cheering || chirping;
                const target: JalakPose = {
                    ...rest,
                    ...(alert ? { eyes: 1, drop: 0, crest: 0.85 } : null),
                    ...(following ? gaze : null),
                    ...(chirping ? chirpPose((now - chirpAt) / 1000) : null),
                    ...(cheering ? cheerPose((now - cheerAt) / 1000) : null),
                    ...(covering ? coverPose : null),
                };
                moving = alert;
                for (const key of jalakChannels) {
                    const omega =
                        key === 'eyes'
                            ? target.eyes < pose.eyes
                                ? 3.5
                                : 9
                            : key === 'wave'
                              ? 30
                              : key === 'drop' || key === 'turn'
                                ? 6
                                : 11;
                    const next = settle(
                        pose[key],
                        velocity[key],
                        target[key],
                        seconds,
                        omega,
                    );
                    pose[key] = next.position;
                    velocity[key] = next.velocity;
                    if (
                        Math.abs(next.position - target[key]) > 0.001 ||
                        Math.abs(next.velocity) > 0.001
                    )
                        moving = true;
                }
            }
            draw();
            frame = moving ? requestAnimationFrame(tick) : 0;
        }
        function wake() {
            if (frame || reducedMotion.matches) return;
            previous = performance.now();
            frame = requestAnimationFrame(tick);
        }
        function move(event: PointerEvent) {
            if (
                event.pointerType !== 'mouse' ||
                !finePointer.matches ||
                performance.now() - started < greetingMs
            )
                return;
            aim(event.clientX, event.clientY);
            lastMove = performance.now();
            wake();
        }
        function motionPreferenceChanged() {
            if (!reducedMotion.matches) return;
            cancelAnimationFrame(frame);
            frame = 0;
            for (const key of jalakChannels)
                svg.style.removeProperty(cssName(key));
        }
        const readyTimer = setTimeout(
            () => setReady(true),
            reducedMotion.matches ? 0 : greetingMs,
        );
        signals.current.wake = wake;
        window.addEventListener('pointermove', move, { passive: true });
        reducedMotion.addEventListener('change', motionPreferenceChanged);
        wake();
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(readyTimer);
            signals.current.wake = () => {};
            window.removeEventListener('pointermove', move);
            reducedMotion.removeEventListener(
                'change',
                motionPreferenceChanged,
            );
        };
    }, [figure, perched]);
    return ready;
}
export function JalakBali({
    ref,
    perched = false,
    sad = false,
    className,
}: {
    ref?: Ref<SVGSVGElement>;
    perched?: boolean;
    sad?: boolean;
    className?: string;
}) {
    const id = useId();
    const above = `${id}-above`;
    const below = `${id}-below`;
    const rightWingClip = `${id}-wing-right`;
    const leftWingClip = `${id}-wing-left`;
    const tailClip = `${id}-tail`;
    const tailDrawing = (
        <g>
            <path d={tail} fill="white" stroke="none" />
            <rect
                x="70"
                y="250"
                width="100"
                height="20"
                fill="var(--color-jalak-ink)"
                stroke="none"
                clipPath={`url(#${tailClip})`}
            />
            <path d={tail} />
        </g>
    );
    const feet = (
        <g>
            <path
                d="M107 216v15M133 216v15M99 238l8-7 8 7M125 238l8-7 8 7"
                strokeWidth="10"
            />
            <path
                d="M107 216v15M133 216v15M99 238l8-7 8 7M125 238l8-7 8 7"
                stroke="var(--color-jalak-legs)"
                strokeWidth="4"
            />
        </g>
    );
    return (
        <svg
            ref={ref}
            aria-hidden="true"
            viewBox="0 0 240 256"
            fill="none"
            stroke="var(--color-jalak-ink)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
                'jalak block overflow-visible',
                perched && 'jalak--perched',
                sad && 'jalak--sad',
                className,
            )}
        >
            <defs>
                <clipPath id={above}>
                    <rect x="-80" y="-120" width="400" height="352" />
                </clipPath>
                <clipPath id={below}>
                    <rect x="-80" y="232" width="400" height="80" />
                </clipPath>
                <clipPath id={rightWingClip}>
                    <path d={rightWing} />
                </clipPath>
                <clipPath id={leftWingClip}>
                    <path d={leftWing} />
                </clipPath>
                <clipPath id={tailClip}>
                    <path d={tail} />
                </clipPath>
            </defs>
            {!perched && (
                <ellipse
                    cx="120"
                    cy="242"
                    rx="52"
                    ry="7"
                    fill="var(--color-primary-deep)"
                    opacity=".12"
                    stroke="none"
                />
            )}
            <g clipPath={perched ? `url(#${above})` : undefined}>
                <g className="jalak-rise">
                    <g className="jalak-body">
                        {tailDrawing}
                        <g className="jalak-breath">
                            <g className="jalak-head">
                                <g className="jalak-crest">
                                    <g
                                        className="jalak-crest-sway"
                                        fill="white"
                                    >
                                        <path d="M106 50C94 32 74 22 50 22C68 30 84 44 94 60Z" />
                                        <path d="M114 44C106 22 86 6 62 2C80 14 94 30 102 52Z" />
                                        <path d="M124 41C124 21 114 5 98 -3C108 13 114 29 114 46Z" />
                                    </g>
                                </g>
                            </g>
                            <g strokeWidth="10">
                                <circle cx="120" cy="94" r="58" />
                                <ellipse cx="120" cy="168" rx="64" ry="56" />
                            </g>
                            <g fill="white" stroke="none">
                                <circle cx="120" cy="94" r="58" />
                                <ellipse cx="120" cy="168" rx="64" ry="56" />
                            </g>
                            <ellipse
                                cx="120"
                                cy="194"
                                rx="44"
                                ry="24"
                                fill="var(--color-secondary)"
                                stroke="none"
                            />
                            <g className="jalak-head">
                                <g
                                    fill="var(--color-activity-blue)"
                                    stroke="none"
                                >
                                    <ellipse
                                        cx="98"
                                        cy="94"
                                        rx="20"
                                        ry="17"
                                        transform="rotate(-14 98 94)"
                                    />
                                    <ellipse
                                        cx="142"
                                        cy="94"
                                        rx="20"
                                        ry="17"
                                        transform="rotate(14 142 94)"
                                    />
                                </g>
                                {sad ? (
                                    <>
                                        <path
                                            d="M88 99q11-8 22 0M130 99q11-8 22 0"
                                            strokeWidth="4.5"
                                        />
                                        <g
                                            fill="var(--color-primary)"
                                            stroke="none"
                                        >
                                            <path
                                                className="crying-tear"
                                                d="M92 108q-6 9 0 9t0-9Z"
                                            />
                                            <path
                                                className="crying-tear crying-tear-right"
                                                d="M148 108q-6 9 0 9t0-9Z"
                                            />
                                        </g>
                                    </>
                                ) : (
                                    <>
                                        <g
                                            className="jalak-eyes-open"
                                            stroke="none"
                                        >
                                            <g className="jalak-blink">
                                                <g className="jalak-pupils">
                                                    <g fill="var(--color-jalak-ink)">
                                                        <circle
                                                            cx="99"
                                                            cy="95"
                                                            r="10"
                                                        />
                                                        <circle
                                                            cx="141"
                                                            cy="95"
                                                            r="10"
                                                        />
                                                    </g>
                                                    <g fill="white">
                                                        <circle
                                                            cx="102.5"
                                                            cy="91"
                                                            r="3.5"
                                                        />
                                                        <circle
                                                            cx="144.5"
                                                            cy="91"
                                                            r="3.5"
                                                        />
                                                    </g>
                                                </g>
                                            </g>
                                        </g>
                                        <path
                                            className="jalak-eyes-closed"
                                            d="M88 96q11 8 22 0M130 96q11 8 22 0"
                                            strokeWidth="4.5"
                                        />
                                    </>
                                )}
                                <g
                                    fill="var(--color-jalak-blush)"
                                    stroke="none"
                                >
                                    <ellipse cx="78" cy="117" rx="10" ry="6" />
                                    <ellipse cx="162" cy="117" rx="10" ry="6" />
                                </g>
                                <ellipse
                                    className="jalak-mouth"
                                    cx="120"
                                    cy="118"
                                    rx="8"
                                    ry="6"
                                    fill="var(--color-jalak-mouth)"
                                    stroke="none"
                                />
                                <path
                                    className="jalak-beak-lower"
                                    d="M110 114Q120 128 130 114Z"
                                    fill="var(--color-jalak-beak)"
                                    strokeWidth="3"
                                />
                                <path
                                    d="M105 106Q120 97 135 106Q129 118 120 123Q111 118 105 106Z"
                                    fill="var(--color-jalak-beak)"
                                    strokeWidth="3.5"
                                />
                            </g>
                            <g className="jalak-wing-left">
                                <path d={leftWing} fill="white" stroke="none" />
                                <rect
                                    x="20"
                                    y="190"
                                    width="70"
                                    height="40"
                                    fill="var(--color-jalak-ink)"
                                    stroke="none"
                                    clipPath={`url(#${leftWingClip})`}
                                />
                                <path d={leftWing} />
                            </g>
                            <g className="jalak-wing-right">
                                <path
                                    d={rightWing}
                                    fill="white"
                                    stroke="none"
                                />
                                <rect
                                    x="150"
                                    y="190"
                                    width="70"
                                    height="40"
                                    fill="var(--color-jalak-ink)"
                                    stroke="none"
                                    clipPath={`url(#${rightWingClip})`}
                                />
                                <path d={rightWing} />
                            </g>
                        </g>
                        {feet}
                    </g>
                </g>
            </g>
            {perched && (
                <>
                    <g className="jalak-front" clipPath={`url(#${below})`}>
                        <g className="jalak-rise">
                            <g className="jalak-body">
                                {tailDrawing}
                                {feet}
                            </g>
                        </g>
                    </g>
                    <g
                        className="jalak-sleep-marks font-display"
                        fill="var(--color-primary)"
                        stroke="none"
                        fontWeight="700"
                    >
                        <g className="jalak-float">
                            <text x="182" y="66" fontSize="20">
                                z
                            </text>
                            <text x="200" y="44" fontSize="26">
                                z
                            </text>
                            <text x="220" y="20" fontSize="32">
                                Z
                            </text>
                        </g>
                    </g>
                </>
            )}
        </svg>
    );
}

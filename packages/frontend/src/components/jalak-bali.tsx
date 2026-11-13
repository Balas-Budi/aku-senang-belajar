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
const body =
    'M120 38C158 38 182 66 182 104C182 122 178 134 173 142C180 154 183 170 181 186C178 210 152 226 120 226C88 226 62 210 59 186C57 170 60 154 67 142C62 134 58 122 58 104C58 66 82 38 120 38Z';
const rightWing =
    'M172 146C188 152 194 170 192 190C191 200 188 206 184 206C184 212 180 216 175 214C173 220 167 222 163 218C160 206 158 188 158 172C158 160 162 150 172 146Z';
const leftWing =
    'M68 146C52 152 46 170 48 190C49 200 52 206 56 206C56 212 60 216 65 214C67 220 73 222 77 218C80 206 82 188 82 172C82 160 78 150 68 146Z';
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
    const bodyClip = `${id}-body`;
    const feet = (
        <g>
            <path
                d="M104 220v18M96 244l8-6 8 6M136 220v18M128 244l8-6 8 6"
                strokeWidth="10"
            />
            <path
                d="M104 220v18M96 244l8-6 8 6M136 220v18M128 244l8-6 8 6"
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
                <clipPath id={bodyClip}>
                    <path d={body} />
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
                        <g className="jalak-breath">
                            <g className="jalak-head">
                                <g className="jalak-crest">
                                    <g
                                        className="jalak-crest-sway"
                                        fill="white"
                                    >
                                        <path d="M104 58C84 54 62 44 46 30C66 22 98 30 114 48Z" />
                                        <path d="M106 50C90 36 76 18 72 0C92 4 114 20 120 42Z" />
                                        <path d="M112 46C104 28 100 8 108 -6C122 4 132 24 128 44Z" />
                                    </g>
                                </g>
                            </g>
                            <path d={body} strokeWidth="10" />
                            <path d={body} fill="white" stroke="none" />
                            <ellipse
                                cx="120"
                                cy="246"
                                rx="80"
                                ry="40"
                                fill="var(--color-secondary)"
                                opacity=".5"
                                stroke="none"
                                clipPath={`url(#${bodyClip})`}
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
                                            d="M86 74L106 67M134 67L154 74"
                                            strokeWidth="4"
                                        />
                                        <path
                                            d="M88 99q11-8 22 0M130 99q11-8 22 0"
                                            strokeWidth="4.5"
                                        />
                                        <g
                                            fill="var(--color-jalak-tear)"
                                            stroke="white"
                                            strokeWidth="2"
                                        >
                                            <path
                                                className="crying-stream"
                                                d="M95 101Q93 118 92 132Q98 135 104 131Q103 116 103 101Z"
                                            />
                                            <path
                                                className="crying-stream"
                                                d="M145 101Q147 118 148 132Q142 135 136 131Q137 116 137 101Z"
                                            />
                                        </g>
                                        <g
                                            fill="var(--color-jalak-tear)"
                                            stroke="var(--color-activity-blue)"
                                            strokeWidth="1.5"
                                        >
                                            <path
                                                className="crying-tear"
                                                d="M98 134q-6 9 0 11t0-11Z"
                                            />
                                            <path
                                                className="crying-tear crying-tear-right"
                                                d="M142 134q-6 9 0 11t0-11Z"
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
                                    y="200"
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
                                    y="200"
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
                            <g className="jalak-body">{feet}</g>
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

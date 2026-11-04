import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import {
    cheerPose,
    cheerSeconds,
    greetingPose,
    greetingSeconds,
    pandaChannels,
    restingPose,
    settle,
} from './panda-motion';
const torso =
    'M236 260C214 236 220 168 262 146C298 128 360 124 408 134C452 144 482 176 482 214C482 242 470 260 450 260Z';
const head =
    'M200 80C262 80 302 114 303 160C304 206 266 238 200 238C134 238 96 206 97 160C98 114 138 80 200 80Z';
const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));
const cssName = (channel: string) =>
    `--panda-${channel.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
export function LoungingPanda({
    watching = false,
    lookAt,
    cheers = 0,
}: {
    watching?: boolean;
    lookAt?: RefObject<HTMLElement | null>;
    cheers?: number;
}) {
    const illustration = useRef<SVGSVGElement>(null);
    const signals = useRef({
        watching,
        lookAt,
        cheerAt: -Infinity,
        wake: () => {},
    });
    const [ready, setReady] = useState(false);
    const id = useId();
    const edgeClip = `${id}-edge`;
    const torsoClip = `${id}-torso`;
    const headClip = `${id}-head`;
    function cheer() {
        signals.current.cheerAt = performance.now();
        signals.current.wake();
    }
    useEffect(() => {
        signals.current.watching = watching;
        signals.current.lookAt = lookAt;
        signals.current.wake();
    }, [watching, lookAt]);
    useEffect(() => {
        if (cheers) cheer();
    }, [cheers]);
    useEffect(() => {
        const element = illustration.current;
        if (!element) return;
        const svg: SVGSVGElement = element;
        const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
        const started = performance.now();
        const pose = greetingPose(0);
        const velocity = { ...restingPose };
        const gaze = { drop: 0, turn: 0, lookX: 0, lookY: 0 };
        const ahead = { drop: 0, turn: 0, lookX: 0, lookY: 0 };
        let previous = started;
        let lastMove = -Infinity;
        let frame = 0;
        function draw() {
            for (const key of pandaChannels)
                svg.style.setProperty(cssName(key), String(pose[key]));
        }
        function aim(x: number, y: number) {
            const bounds = svg.getBoundingClientRect();
            const dx = x - bounds.left - (bounds.width * 160) / 490;
            const dy = y - bounds.top - bounds.height / 2;
            const distance = Math.max(Math.hypot(dx, dy), 1);
            const reach = Math.min(1, distance / 180) / distance;
            gaze.lookX = dx * reach;
            gaze.lookY = dy * reach;
            gaze.turn = gaze.lookX * 5;
            gaze.drop = clamp(dy / 400, 0, 0.4);
        }
        function tick(now: number) {
            const seconds = Math.min((now - previous) / 1000, 0.05);
            previous = now;
            let moving = true;
            if (now - started < greetingSeconds * 1000) {
                const next = greetingPose((now - started) / 1000);
                for (const key of pandaChannels) {
                    velocity[key] =
                        seconds > 0 ? (next[key] - pose[key]) / seconds : 0;
                    pose[key] = next[key];
                }
            } else {
                const { watching, lookAt, cheerAt } = signals.current;
                const watched = watching ? lookAt?.current : null;
                if (watched) {
                    const box = watched.getBoundingClientRect();
                    aim(box.left + box.width / 2, box.top + box.height / 2);
                }
                const following =
                    Boolean(watched) ||
                    (finePointer.matches && now - lastMove < 1500);
                const cheering = now - cheerAt < cheerSeconds * 1000;
                const gazeAway =
                    pose.drop < 0.95 ||
                    Math.abs(pose.turn) > 0.3 ||
                    Math.abs(pose.lookX) > 0.1 ||
                    Math.abs(pose.lookY) > 0.1;
                const target =
                    following || cheering
                        ? {
                              ...restingPose,
                              ...(following ? gaze : ahead),
                              eyes: 1,
                              ...(cheering
                                  ? cheerPose((now - cheerAt) / 1000)
                                  : null),
                          }
                        : { ...restingPose, eyes: gazeAway ? 1 : 0 };
                moving = following || cheering;
                for (const key of pandaChannels) {
                    const omega =
                        key === 'eyes'
                            ? target.eyes < pose.eyes
                                ? 3.5
                                : 8
                            : key === 'drop' || key === 'turn'
                              ? 6
                              : key === 'wave'
                                ? 30
                                : 10;
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
                performance.now() - started < greetingSeconds * 1000
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
            setReady(false);
            for (const key of pandaChannels)
                svg.style.removeProperty(cssName(key));
        }
        const readyTimer = reducedMotion.matches
            ? undefined
            : setTimeout(() => setReady(true), greetingSeconds * 1000);
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
    }, []);
    return (
        <div className="pointer-events-none absolute -top-[93px] left-2 z-1 w-44 sm:left-7">
            <svg
                ref={illustration}
                aria-hidden="true"
                viewBox="40 0 490 320"
                fill="none"
                stroke="var(--color-panda-ink)"
                strokeWidth="6"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="sitting-friend block w-full overflow-visible"
            >
                <defs>
                    <clipPath id={edgeClip}>
                        <rect x="-100" y="-100" width="800" height="363" />
                    </clipPath>
                    <clipPath id={torsoClip}>
                        <path d={torso} />
                    </clipPath>
                    <clipPath id={headClip}>
                        <path d={head} />
                    </clipPath>
                </defs>
                <g clipPath={`url(#${edgeClip})`}>
                    <g className="panda-rise">
                        <g className="panda-breath">
                            <g className="panda-body">
                                <circle cx="478" cy="160" r="14" fill="white" />
                                <path d={torso} fill="white" stroke="none" />
                                <g clipPath={`url(#${torsoClip})`}>
                                    <ellipse
                                        cx="370"
                                        cy="270"
                                        rx="150"
                                        ry="32"
                                        fill="var(--color-secondary)"
                                        stroke="none"
                                    />
                                    <path
                                        d="M200 100L314 100C332 104 344 112 344 112C356 166 354 220 342 272L200 272Z"
                                        fill="var(--color-panda-fur)"
                                    />
                                </g>
                                <path d={torso} />
                            </g>
                            <g className="panda-arm-rest">
                                <path
                                    d="M130 226L250 228C290 228 318 220 330 200L352 204C366 238 352 262 320 260L132 260C108 260 104 228 130 226Z"
                                    fill="var(--color-panda-fur)"
                                    stroke="none"
                                />
                                <path d="M330 200C318 220 290 228 250 228L130 226C104 228 108 260 132 260L320 260C352 262 366 238 352 204" />
                            </g>
                            <g className="panda-head">
                                <g fill="var(--color-panda-fur)">
                                    <circle cx="122" cy="94" r="30" />
                                    <circle cx="278" cy="94" r="30" />
                                </g>
                                <g fill="var(--color-panda-ear)" stroke="none">
                                    <circle cx="128" cy="100" r="15" />
                                    <circle cx="272" cy="100" r="15" />
                                </g>
                                <path d={head} fill="white" stroke="none" />
                                <ellipse
                                    cx="200"
                                    cy="252"
                                    rx="120"
                                    ry="40"
                                    fill="var(--color-secondary)"
                                    stroke="none"
                                    clipPath={`url(#${headClip})`}
                                />
                                <path d={head} />
                                <path
                                    d="M190 82C190 66 206 60 214 68C206 68 202 74 204 82"
                                    fill="white"
                                    strokeWidth="3.5"
                                />
                                <g className="panda-face">
                                    <g
                                        fill="var(--color-panda-fur)"
                                        stroke="none"
                                    >
                                        <ellipse
                                            cx="160"
                                            cy="162"
                                            rx="31"
                                            ry="27"
                                            transform="rotate(-18 160 162)"
                                        />
                                        <ellipse
                                            cx="240"
                                            cy="162"
                                            rx="31"
                                            ry="27"
                                            transform="rotate(18 240 162)"
                                        />
                                    </g>
                                    <g className="panda-eyes" stroke="none">
                                        <g className="panda-blink">
                                            <g fill="white">
                                                <circle
                                                    cx="166"
                                                    cy="160"
                                                    r="13"
                                                />
                                                <circle
                                                    cx="234"
                                                    cy="160"
                                                    r="13"
                                                />
                                            </g>
                                            <g className="panda-pupils">
                                                <g fill="var(--color-panda-ink)">
                                                    <circle
                                                        cx="168"
                                                        cy="162"
                                                        r="8.5"
                                                    />
                                                    <circle
                                                        cx="232"
                                                        cy="162"
                                                        r="8.5"
                                                    />
                                                </g>
                                                <g fill="white">
                                                    <circle
                                                        cx="171"
                                                        cy="158"
                                                        r="3.2"
                                                    />
                                                    <circle
                                                        cx="235"
                                                        cy="158"
                                                        r="3.2"
                                                    />
                                                </g>
                                            </g>
                                        </g>
                                    </g>
                                    <path
                                        className="panda-eyes-closed"
                                        d="M146 162q14 11 28 0M226 162q14 11 28 0"
                                        stroke="white"
                                    />
                                    <g
                                        fill="var(--color-panda-blush)"
                                        stroke="none"
                                    >
                                        <ellipse
                                            cx="130"
                                            cy="196"
                                            rx="13"
                                            ry="7"
                                        />
                                        <ellipse
                                            cx="270"
                                            cy="196"
                                            rx="13"
                                            ry="7"
                                        />
                                    </g>
                                    <path
                                        d="M191 183Q200 179 209 183Q207 191 200 193Q193 191 191 183Z"
                                        fill="var(--color-panda-ink)"
                                        strokeWidth="3"
                                    />
                                    <ellipse
                                        className="panda-mouth-asleep"
                                        cx="200"
                                        cy="204"
                                        rx="6"
                                        ry="7"
                                        fill="var(--color-panda-mouth)"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="panda-mouth-awake"
                                        d="M200 192v4M200 196q-5 6-10 1M200 196q5 6 10 1"
                                        strokeWidth="4.5"
                                    />
                                </g>
                            </g>
                            <g className="panda-arm-a">
                                <path
                                    d="M300 260L132 260C108 260 104 228 130 226L300 224Z"
                                    fill="var(--color-panda-fur)"
                                    stroke="none"
                                />
                                <path d="M300 260L132 260C108 260 104 228 130 226L300 224" />
                            </g>
                            <g className="panda-arm-b">
                                <g className="panda-wave">
                                    <path
                                        d="M306 272C300 220 302 160 314 128C322 106 350 100 362 116C372 130 366 170 356 210C352 230 350 252 350 272Z"
                                        fill="var(--color-panda-fur)"
                                    />
                                    <g
                                        fill="var(--color-panda-ear)"
                                        stroke="none"
                                    >
                                        <ellipse
                                            cx="337"
                                            cy="146"
                                            rx="13"
                                            ry="10"
                                        />
                                        <circle cx="322" cy="126" r="5" />
                                        <circle cx="337" cy="118" r="5" />
                                        <circle cx="352" cy="124" r="5" />
                                    </g>
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
                <g className="panda-rise">
                    <g className="panda-breath">
                        <g className="panda-body">
                            <path
                                className="panda-leg"
                                d="M392 260C380 228 398 200 428 198C458 196 480 214 486 238C492 258 500 282 494 296C488 308 456 310 446 298C438 288 438 274 438 266C438 262 434 260 428 260Z"
                                fill="var(--color-panda-fur)"
                            />
                            <path
                                className="panda-leg"
                                d="M462 308v-9M477 306v-9"
                                strokeWidth="4"
                            />
                        </g>
                    </g>
                </g>
                <g
                    className="panda-awake-marks"
                    fill="var(--color-activity-orange)"
                    strokeWidth="4"
                >
                    <g className="panda-twinkle">
                        <path d="M62 128l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" />
                        <path d="M330 70l3.5 8 8 3.5-8 3.5-3.5 8-3.5-8-8-3.5 8-3.5z" />
                    </g>
                </g>
                <g
                    className="panda-tail-marks"
                    stroke="var(--color-activity-orange)"
                    strokeWidth="5"
                >
                    <g className="panda-twinkle">
                        <path d="M494 140q8 6 6 16M506 130q12 10 9 26" />
                    </g>
                </g>
                <g
                    className="panda-sleep-marks"
                    fill="var(--color-primary)"
                    stroke="none"
                    fontFamily="Arial Black, Arial, sans-serif"
                    fontWeight="900"
                >
                    <g className="panda-float">
                        <text x="322" y="96" fontSize="24">
                            z
                        </text>
                        <text x="346" y="72" fontSize="32">
                            z
                        </text>
                        <text x="376" y="44" fontSize="40">
                            Z
                        </text>
                    </g>
                </g>
            </svg>
            {ready && (
                <button
                    type="button"
                    aria-label="Sapa panda"
                    onClick={cheer}
                    className="focus-visible:outline-ring pointer-events-auto absolute top-[18%] left-[10%] h-[64%] w-[46%] cursor-pointer rounded-full focus-visible:outline-3 focus-visible:outline-offset-2"
                />
            )}
        </div>
    );
}

export const pandaChannels = [
    'rise',
    'hop',
    'body',
    'drop',
    'turn',
    'eyes',
    'lookX',
    'lookY',
    'armA',
    'armB',
    'wave',
] as const;
export type PandaPose = Record<(typeof pandaChannels)[number], number>;
export const restingPose: PandaPose = {
    rise: 1,
    hop: 0,
    body: 1,
    drop: 1,
    turn: 0,
    eyes: 0,
    lookX: 0,
    lookY: 0,
    armA: 1,
    armB: 1,
    wave: 0,
};
export const greetingSeconds = 7.6;
export const cheerSeconds = 2.4;
const progress = (seconds: number, from: number, length: number) =>
    Math.max(0, Math.min(1, (seconds - from) / length));
const twoWaves = (value: number) => 8 * (1 - Math.cos(value * Math.PI * 4));
function ease(value: number) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
}
export function cheerPose(seconds: number) {
    return {
        armB: seconds < 1.8 ? 0 : 1,
        wave: twoWaves(progress(seconds, 0.45, 1.2)),
    };
}
export function greetingPose(seconds: number): PandaPose {
    const span = (from: number, to: number) =>
        ease((seconds - from) / (to - from));
    return {
        rise: span(3, 3.7),
        hop: Math.sin(Math.PI * span(5.3, 6.3)),
        body: span(5.3, 6.3),
        drop: span(6.2, 7.1),
        turn: 0,
        eyes: 1 - span(6.6, 7.6),
        lookX: 0,
        lookY: 0,
        armA: span(3.45, 3.8),
        armB: span(5.3, 6.1),
        wave: twoWaves(progress(seconds, 3.9, 1.2)),
    };
}
export function settle(
    position: number,
    velocity: number,
    target: number,
    seconds: number,
    omega: number,
) {
    const decay = Math.exp(-omega * seconds);
    const displacement = position - target;
    const impulse = (velocity + omega * displacement) * seconds;
    return {
        position: target + (displacement + impulse) * decay,
        velocity: (velocity - omega * impulse) * decay,
    };
}

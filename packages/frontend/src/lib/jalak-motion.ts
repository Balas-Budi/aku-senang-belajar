export const jalakChannels = [
    'rise',
    'hop',
    'body',
    'drop',
    'turn',
    'eyes',
    'lookX',
    'lookY',
    'wing',
    'flap',
    'wave',
    'beak',
    'crest',
    'cover',
] as const;
export type JalakPose = Record<(typeof jalakChannels)[number], number>;
export const awakePose: JalakPose = {
    rise: 1,
    hop: 0,
    body: 1,
    drop: 0,
    turn: 0,
    eyes: 1,
    lookX: 0,
    lookY: 0,
    wing: 0,
    flap: 0,
    wave: 0,
    beak: 0,
    crest: 0.7,
    cover: 0,
};
export const asleepPose: JalakPose = {
    ...awakePose,
    drop: 1,
    eyes: 0,
    crest: 0.25,
};
export const perchedGreetingSeconds = 7.6;
export const standingGreetingSeconds = 2.4;
export const cheerSeconds = 2.4;
export const chirpSeconds = 1.6;
const progress = (seconds: number, from: number, length: number) =>
    Math.max(0, Math.min(1, (seconds - from) / length));
const twoWaves = (value: number) => 16 * Math.sin(value * Math.PI * 4);
function ease(value: number) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
}
function spanAt(seconds: number) {
    return (from: number, to: number) => ease((seconds - from) / (to - from));
}
export function perchedGreeting(seconds: number): JalakPose {
    const span = spanAt(seconds);
    const raised = span(3.6, 3.9) - span(5.1, 5.4);
    const settled = span(6.3, 7);
    return {
        ...awakePose,
        rise: span(3, 3.6),
        hop: Math.sin(Math.PI * span(5.4, 6.3)),
        body: span(5.4, 6.3),
        drop: settled,
        eyes: 1 - span(6.7, 7.6),
        wing: raised,
        wave: twoWaves(progress(seconds, 3.9, 1.2)),
        beak: raised,
        crest: 0.7 + 0.3 * raised - 0.45 * settled,
    };
}
export function standingGreeting(seconds: number): JalakPose {
    const span = spanAt(seconds);
    const raised = span(0.3, 0.6) - span(1.8, 2.2);
    return {
        ...awakePose,
        wing: raised,
        wave: twoWaves(progress(seconds, 0.6, 1.2)),
        beak: raised,
        crest: 0.7 + 0.3 * raised,
    };
}
export function cheerPose(seconds: number): Partial<JalakPose> {
    const lifted = seconds < cheerSeconds - 0.5 ? 1 : 0;
    return {
        wing: lifted,
        flap: lifted,
        wave: lifted * 18 * Math.sin(seconds * Math.PI * 6),
        beak: lifted,
        crest: 1,
        hop: lifted * Math.abs(Math.sin(seconds * Math.PI * 2.4)),
    };
}
export function chirpPose(seconds: number): Partial<JalakPose> {
    return {
        wing: seconds < chirpSeconds - 0.3 ? 1 : 0,
        wave: twoWaves(progress(seconds, 0.15, 1.2)),
        beak: seconds < 1.2 ? 1 : 0,
        crest: 1,
    };
}
export const coverPose: Partial<JalakPose> = {
    cover: 1,
    eyes: 0,
    wing: 0,
    flap: 0,
    crest: 0.5,
};
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

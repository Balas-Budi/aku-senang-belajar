import { writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'packages/frontend/public/lottie';
const hex = (value) =>
    [1, 3, 5]
        .map(
            (index) =>
                Math.round(
                    (parseInt(value.slice(index, index + 2), 16) / 255) * 1000,
                ) / 1000,
        )
        .concat(1);
const ink = hex('#1c1660');
const palette = ['#4c42cf', '#f46800', '#0099f3', '#34bd43', '#e11970'].map(
    hex,
);
const r2 = (value) => Math.round(value * 100) / 100;
const still = (k) => ({ a: 0, k });
const easeOut = { i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0] } };
const easeIn = { i: { x: [0.7], y: [1] }, o: { x: [0.6], y: [0] } };
function track(frames, dims) {
    const k = frames.map(([t, s, ease = easeOut], index) => {
        const frame = { t, s: Array.isArray(s) ? s : [s] };
        if (index < frames.length - 1) {
            frame.i = {
                x: Array(dims).fill(ease.i.x[0]),
                y: Array(dims).fill(ease.i.y[0]),
            };
            frame.o = {
                x: Array(dims).fill(ease.o.x[0]),
                y: Array(dims).fill(ease.o.y[0]),
            };
        }
        return frame;
    });
    return { a: 1, k };
}
function positionTrack(frames) {
    const k = frames.map(([t, s, ease = easeOut], index) => {
        const frame = { t, s: [...s, 0] };
        if (index < frames.length - 1) {
            frame.i = { x: [ease.i.x[0]], y: [ease.i.y[0]] };
            frame.o = { x: [ease.o.x[0]], y: [ease.o.y[0]] };
            frame.to = [0, 0, 0];
            frame.ti = [0, 0, 0];
        }
        return frame;
    });
    return { a: 1, k };
}
const transform = {
    ty: 'tr',
    p: still([0, 0]),
    a: still([0, 0]),
    s: still([100, 100]),
    r: still(0),
    o: still(100),
    sk: still(0),
    sa: still(0),
    nm: 'transform',
};
const fill = (color) => ({
    ty: 'fl',
    c: still(color),
    o: still(100),
    r: 1,
    nm: 'fill',
});
const stroke = (width) => ({
    ty: 'st',
    c: still(ink),
    o: still(100),
    w: still(width),
    lc: 2,
    lj: 2,
    ml: 4,
    nm: 'outline',
});
const group = (items, at = [0, 0], turn = 0) => ({
    ty: 'gr',
    nm: 'shape',
    it: [...items, { ...transform, p: still(at), r: still(turn) }],
});
const star = (outer) => ({
    ty: 'sr',
    sy: 1,
    d: 1,
    pt: still(5),
    p: still([0, 0]),
    r: still(0),
    ir: still(outer * 0.48),
    is: still(0),
    or: still(outer),
    os: still(0),
    nm: 'star',
});
const circle = (size) => ({
    ty: 'el',
    d: 1,
    p: still([0, 0]),
    s: still([size, size]),
    nm: 'circle',
});
const rounded = (width, height, radius) => ({
    ty: 'rc',
    d: 1,
    p: still([0, 0]),
    s: still([width, height]),
    r: still(radius),
    nm: 'rect',
});
const ellipse = (width, height) => ({
    ty: 'el',
    d: 1,
    p: still([0, 0]),
    s: still([width, height]),
    nm: 'ellipse',
});
function layer(index, name, ks, shapes, frames) {
    return {
        ddd: 0,
        ind: index,
        ty: 4,
        nm: name,
        sr: 1,
        ks: { a: still([0, 0, 0]), ...ks },
        ao: 0,
        shapes,
        ip: 0,
        op: frames,
        st: 0,
        bm: 0,
    };
}
function animation(name, width, height, frames, layers) {
    return {
        v: '5.12.2',
        fr: 60,
        ip: 0,
        op: frames,
        w: width,
        h: height,
        nm: name,
        ddd: 0,
        assets: [],
        layers,
    };
}
const celebrateFrames = 72;
const celebrate = Array.from({ length: 18 }, (_, index) => {
    const angle = Math.PI * (0.08 + (0.84 * index) / 17);
    const distance = 96 + ((index * 37) % 64);
    const start = index % 4;
    const color = palette[index % palette.length];
    const kind = index % 3;
    const shape =
        kind === 0
            ? group([star(13), stroke(2.5), fill(color)])
            : kind === 1
              ? group([circle(16), stroke(2.5), fill(color)])
              : group([rounded(20, 11, 4), stroke(2.5), fill(color)]);
    const x = r2(180 - Math.cos(angle) * distance * 1.55);
    const y = r2(222 - Math.sin(angle) * distance);
    const turn = ((index * 97) % 300) - 150;
    return layer(
        index + 1,
        `piece-${index + 1}`,
        {
            p: positionTrack([
                [start, [180, 222]],
                [start + 38, [x, y], easeOut],
                [celebrateFrames, [r2(x + (index % 2 ? 10 : -10)), r2(y + 22)]],
            ]),
            s: track(
                [
                    [start, [30, 30, 100]],
                    [start + 10, [100, 100, 100]],
                    [celebrateFrames, [70, 70, 100]],
                ],
                3,
            ),
            r: track(
                [
                    [start, 0],
                    [celebrateFrames, turn],
                ],
                1,
            ),
            o: track(
                [
                    [start, 100],
                    [52, 100, easeIn],
                    [celebrateFrames, 0],
                ],
                1,
            ),
        },
        [shape],
        celebrateFrames,
    );
});
const chirpFrames = 64;
const notes = [
    { at: [52, 74], start: 0, color: palette[0], sway: -14 },
    { at: [86, 58], start: 8, color: palette[4], sway: 12 },
    { at: [122, 76], start: 16, color: palette[1], sway: -10 },
];
const chirp = notes.map(({ at, start, color, sway }, index) => {
    const note = [
        group([rounded(4, 24, 2), fill(ink)], [7, -11]),
        group([rounded(11, 5, 2.5), fill(ink)], [12, -21], 28),
        group([ellipse(16, 12), stroke(2.5), fill(color)], [0, 0], -20),
    ];
    return layer(
        index + 1,
        `note-${index + 1}`,
        {
            p: positionTrack([
                [start, [80, 152]],
                [start + 34, at, easeOut],
                [chirpFrames, [at[0], at[1] - 10]],
            ]),
            s: track(
                [
                    [start, [0, 0, 100]],
                    [start + 10, [110, 110, 100]],
                    [start + 16, [100, 100, 100]],
                    [chirpFrames, [100, 100, 100]],
                ],
                3,
            ),
            r: track(
                [
                    [start, 0],
                    [start + 20, sway],
                    [chirpFrames, -sway / 2],
                ],
                1,
            ),
            o: track(
                [
                    [start, 100],
                    [chirpFrames - 14, 100, easeIn],
                    [chirpFrames, 0],
                ],
                1,
            ),
        },
        note,
        chirpFrames,
    );
});
writeFileSync(
    `${out}/celebrate.json`,
    JSON.stringify(
        animation('celebrate', 360, 240, celebrateFrames, celebrate),
    ),
);
writeFileSync(
    `${out}/chirp.json`,
    JSON.stringify(animation('chirp', 160, 180, chirpFrames, chirp)),
);

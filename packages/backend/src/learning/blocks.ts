import { z } from 'zod';

const illustration = z.enum([
    'loaf-whole',
    'loaf-quarters',
    'loaf-quarters-unequal',
    'loaf-quarter-marked',
    'loaf-halves',
    'loaf-pair',
    'round-quarters',
    'round-quarters-unequal',
    'round-quarter-marked',
    'round-thirds',
    'paper-quarters',
]);

const screenText = z
    .string()
    .trim()
    .min(1)
    .superRefine((text, context) => {
        const sentences = text.split(/(?<=[.!?])\s+/).length;

        if (sentences > 2) {
            context.addIssue({
                code: 'custom',
                message: `A student screen holds at most two sentences; this one has ${sentences}, as each ".", "!", or "?" ends one. Join them with a comma or "dan", or cut one, rather than only rewording`,
            });
        }
    });

export const diagramFills = [
    'none',
    'paper',
    'soft',
    'mark',
    'blue',
    'green',
    'yellow',
] as const;
export const diagramStrokes = ['ink', 'mark'] as const;
const colourFills = new Set<string>(['mark', 'blue', 'green', 'yellow']);
const plainFills = new Set<string>(['none', 'paper', 'soft']);

export const DIAGRAM = {
    width: 160,
    height: 120,
    shapes: 40,
    texts: 6,
    colours: 3,
    textLength: 12,
    charWidth: 8,
    wideCharWidth: 10,
    labelMin: 10,
    labelMax: 200,
    points: 20,
    pathLength: 300,
    pathCommands: 30,
} as const;

export const textWidth = (text: string) =>
    [...text].reduce(
        (width, char) =>
            width +
            (/[\p{N}\p{Lu}]/u.test(char)
                ? DIAGRAM.wideCharWidth
                : DIAGRAM.charWidth),
        0,
    );

const spoken = (text: string) =>
    text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/ ?\/ ?/g, '/')
        .trim();

export function diagramName({ label, shapes }: Diagram) {
    const said = spoken(label);
    const unsaid = new Set(
        shapes.flatMap((shape) =>
            shape.type === 'text' && !said.includes(spoken(shape.text))
                ? [shape.text]
                : [],
        ),
    );

    if (unsaid.size === 0) return label;

    const sentence = /[.!?]$/.test(label) ? label : `${label}.`;

    return `${sentence} Tulisan di gambar: ${[...unsaid].join(', ')}.`;
}

const pathArity = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, A: 7, Z: 0 } as const;
type PathLetter = keyof typeof pathArity;
const inCanvas = (x: number, y: number) =>
    x >= 0 && x <= DIAGRAM.width && y >= 0 && y <= DIAGRAM.height;

function segmentProblem(letter: PathLetter, n: number[]): string | null {
    if (letter === 'H')
        return n[0] >= 0 && n[0] <= 160
            ? null
            : `H x ${n[0]} is outside 0 to 160`;
    if (letter === 'V')
        return n[0] >= 0 && n[0] <= 120
            ? null
            : `V y ${n[0]} is outside 0 to 120`;
    if (letter === 'A') {
        const [rx, ry, rotation, large, sweep, x, y] = n;
        if (rx < 0 || rx > 160 || ry < 0 || ry > 120)
            return 'A radii must be within 0 to 160 and 0 to 120';
        if (rotation < -360 || rotation > 360)
            return 'A rotation must be within -360 to 360';
        if (![0, 1].includes(large) || ![0, 1].includes(sweep))
            return "An arc's two flags are 0 or 1";
        return inCanvas(x, y)
            ? null
            : `A point ${x},${y} is outside the 160 by 120 canvas`;
    }
    for (let i = 0; i < n.length; i += 2)
        if (!inCanvas(n[i], n[i + 1]))
            return `${letter} point ${n[i]},${n[i + 1]} is outside the 160 by 120 canvas`;
    return null;
}

export function pathProblem(d: string): string | null {
    if (!/^[MLHVQCAZ\d.,\s-]+$/.test(d))
        return 'd may hold only the capital commands M, L, H, V, Q, C, A, Z, plain numbers, spaces, and commas (no lowercase, relative commands)';
    const tokens = d.match(/[MLHVQCAZ]|-?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? [];
    if (tokens.join('').length !== d.replace(/[\s,]/g, '').length)
        return 'd has a number that is not plain, like 12 or 12.5';
    if (tokens[0] !== 'M') return 'd must start with M';
    if (tokens.filter((t) => t in pathArity).length > DIAGRAM.pathCommands)
        return 'd may hold at most 30 commands';
    for (let i = 0; i < tokens.length;) {
        const letter = tokens[i++] as PathLetter;
        const args: number[] = [];
        while (i < tokens.length && !(tokens[i] in pathArity))
            args.push(Number(tokens[i++]));
        const n = pathArity[letter];
        if (
            n === 0
                ? args.length > 0
                : args.length === 0 || args.length % n !== 0
        )
            return n === 0
                ? 'Z takes no numbers'
                : `${letter} takes ${n} numbers per segment`;
        for (let g = 0; g < args.length; g += n) {
            const problem = segmentProblem(letter, args.slice(g, g + n));
            if (problem) return problem;
        }
    }
    return null;
}

const across = z
    .number({ error: 'must be a number' })
    .min(0, 'must be from 0 to 160 (the canvas is 160 wide)')
    .max(160, 'must be from 0 to 160 (the canvas is 160 wide)');
const down = z
    .number({ error: 'must be a number' })
    .min(0, 'must be from 0 to 120 (the canvas is 120 high)')
    .max(120, 'must be from 0 to 120 (the canvas is 120 high)');
const size = (max: number) =>
    z
        .number({ error: 'must be a number' })
        .positive('must be above 0')
        .max(max, `must be at most ${max}`);
const fill = z.enum(diagramFills, {
    error: 'is missing or wrong: use "none", "paper", "soft", "mark", "blue", "green", or "yellow"',
});
const stroke = z
    .enum(diagramStrokes, { error: 'must be "ink" or "mark"' })
    .optional();
const dashed = z.boolean({ error: 'must be true or false' }).optional();
const point = z.tuple([across, down], {
    error: 'each point is [x, y], like [40, 30]',
});
const parts = z
    .int({ error: 'must be a whole number from 2 to 12' })
    .min(2, 'must be from 2 to 12')
    .max(12, 'must be from 2 to 12')
    .optional();
const shaded = z
    .int({ error: 'must be a whole number' })
    .min(0, 'must be 0 or more')
    .max(12, 'must be at most parts')
    .optional();
const onlyOn = (shapes: string) =>
    z
        .never({
            error: `only ${shapes} can take this key; change the shape or leave the key out`,
        })
        .optional();
const noParts = onlyOn('a rect or circle');
const noStroke = onlyOn('a line, polyline, or path');
const textChars = /^[\p{L}\p{N} /+=<>×÷:,%()°-]+$/u;

type Ctx = z.RefinementCtx;
const need = (
    ok: boolean,
    ctx: Ctx,
    path: (string | number)[],
    message: string,
) => {
    if (!ok) ctx.addIssue({ code: 'custom', path, message });
};

function partsRules(s: { parts?: number; shaded?: number }, ctx: Ctx) {
    need(
        s.shaded === undefined || s.parts !== undefined,
        ctx,
        ['shaded'],
        'needs "parts": set "parts" to the denominator',
    );
    need(
        s.parts === undefined || (s.shaded ?? 0) <= s.parts,
        ctx,
        ['shaded'],
        'must be at most "parts"',
    );
}

const rect = z
    .object({
        type: z.literal('rect'),
        x: across,
        y: down,
        width: size(160),
        height: size(120),
        fill,
        parts,
        shaded,
        stroke: noStroke,
        dashed,
    })
    .superRefine((s, ctx) => {
        need(
            s.x + s.width <= 160,
            ctx,
            ['width'],
            'x + width must be at most 160',
        );
        need(
            s.y + s.height <= 120,
            ctx,
            ['height'],
            'y + height must be at most 120',
        );
        partsRules(s, ctx);
    });
const circle = z
    .object({
        type: z.literal('circle'),
        cx: across,
        cy: down,
        r: size(60),
        fill,
        parts,
        shaded,
        stroke: noStroke,
        dashed,
    })
    .superRefine((s, ctx) => {
        need(
            s.cx - s.r >= 0 &&
                s.cx + s.r <= 160 &&
                s.cy - s.r >= 0 &&
                s.cy + s.r <= 120,
            ctx,
            ['r'],
            'the circle must stay inside the canvas: cx - r and cx + r within 0 to 160, cy - r and cy + r within 0 to 120',
        );
        partsRules(s, ctx);
    });
const ellipse = z
    .object({
        type: z.literal('ellipse'),
        cx: across,
        cy: down,
        rx: size(80),
        ry: size(60),
        fill,
        parts: noParts,
        shaded: noParts,
        stroke: noStroke,
        dashed,
    })
    .superRefine((s, ctx) =>
        need(
            s.cx - s.rx >= 0 &&
                s.cx + s.rx <= 160 &&
                s.cy - s.ry >= 0 &&
                s.cy + s.ry <= 120,
            ctx,
            ['rx'],
            'the ellipse must stay inside the canvas: cx ± rx within 0 to 160, cy ± ry within 0 to 120',
        ),
    );
const line = z
    .object({
        type: z.literal('line'),
        x1: across,
        y1: down,
        x2: across,
        y2: down,
        stroke,
        dashed,
    })
    .superRefine((s, ctx) =>
        need(
            s.x1 !== s.x2 || s.y1 !== s.y2,
            ctx,
            ['x2'],
            'a line needs two different ends',
        ),
    );
const polyline = z.object({
    type: z.literal('polyline'),
    points: z
        .array(point)
        .min(2, 'needs 2 to 20 points')
        .max(20, 'needs 2 to 20 points'),
    stroke,
    dashed,
});
const polygon = z.object({
    type: z.literal('polygon'),
    points: z
        .array(point)
        .min(3, 'needs 3 to 20 points')
        .max(20, 'needs 3 to 20 points'),
    fill,
    parts: noParts,
    shaded: noParts,
    stroke: noStroke,
    dashed,
});
const path = z
    .object({
        type: z.literal('path'),
        d: z
            .string()
            .trim()
            .min(2, 'is empty')
            .max(300, 'must be at most 300 characters'),
        fill,
        parts: noParts,
        shaded: noParts,
        stroke,
        dashed,
    })
    .superRefine((s, ctx) => {
        const problem = pathProblem(s.d);
        need(
            problem === null,
            ctx,
            ['d'],
            `${problem}; for example "M80 60 L80 15 A45 45 0 0 1 125 60 Z" is a quarter of a circle`,
        );
        need(
            s.stroke !== 'mark' || plainFills.has(s.fill),
            ctx,
            ['stroke'],
            '"mark" outlines only a path whose fill is "none", "paper", or "soft"',
        );
    });
const text = z
    .object({
        type: z.literal('text'),
        x: across,
        y: down,
        text: z
            .string()
            .trim()
            .min(1, 'is empty')
            .max(
                12,
                'must be at most 12 characters: a number, a unit, or one or two words',
            )
            .regex(
                textChars,
                'may hold only letters, digits, spaces and / + - = < > × ÷ : , % ( ) °, never a sentence; write 5000, not 5.000',
            ),
        anchor: z
            .enum(['start', 'middle', 'end'], {
                error: 'must be "start", "middle", or "end"',
            })
            .optional(),
    })
    .superRefine((s, ctx) => {
        const w = textWidth(s.text);
        const [min, max] =
            s.anchor === 'start'
                ? [0, 160 - w]
                : s.anchor === 'end'
                  ? [w, 160]
                  : [w / 2, 160 - w / 2];
        need(
            s.x >= min && s.x <= max,
            ctx,
            ['x'],
            `text "${s.text}" is about ${w} units wide, so with anchor "${s.anchor ?? 'middle'}" x must be from ${min} to ${max}`,
        );
        need(
            s.y >= 6 && s.y <= 114,
            ctx,
            ['y'],
            'y is the middle of the text and must be from 6 to 114',
        );
    });

const shape = z.discriminatedUnion(
    'type',
    [rect, circle, ellipse, line, polyline, polygon, path, text],
    {
        error: 'type must be one of rect, circle, ellipse, line, polyline, polygon, path, text',
    },
);

export const diagram = z
    .object({
        label: z
            .string()
            .trim()
            .min(
                10,
                'must say in one to three Indonesian sentences (10 to 200 characters) what the picture shows',
            )
            .max(200, 'must be at most 200 characters')
            .refine((t) => !/[\r\n]/.test(t), 'must be one line')
            .refine(
                (t) => t.split(/(?<=[.!?])\s+/).length <= 3,
                'must be at most three sentences',
            ),
        shapes: z
            .array(shape)
            .min(1, 'must hold 1 to 40 shapes')
            .max(40, 'must hold 1 to 40 shapes'),
    })
    .superRefine(({ label, shapes }, ctx) => {
        if (label.length > DIAGRAM.labelMax || shapes.length > DIAGRAM.shapes)
            return;
        const texts = shapes.filter((s) => s.type === 'text').length;
        need(
            texts <= 6,
            ctx,
            ['shapes'],
            `holds ${texts} text shapes; use at most 6`,
        );
        const colours = new Set(
            shapes.flatMap((s) => [
                ...('fill' in s && colourFills.has(s.fill) ? [s.fill] : []),
                ...('parts' in s && s.parts && (s.shaded ?? 0) > 0
                    ? ['mark']
                    : []),
            ]),
        );
        need(
            colours.size <= 3,
            ctx,
            ['shapes'],
            `uses ${[...colours].join(', ')}; use at most three of "mark", "blue", "green", "yellow"`,
        );
    });

export type Diagram = z.infer<typeof diagram>;

const picture = z.object({
    text: screenText,
    illustration: illustration.optional(),
    diagram: diagram.optional(),
});

const options = z
    .array(
        z.object({
            id: z.string().regex(/^[a-z]$/),
            label: z.string().trim().min(1),
            illustration: illustration.optional(),
        }),
    )
    .min(2)
    .max(4)
    .refine(
        (list) => new Set(list.map((option) => option.id)).size === list.length,
        'Each option needs its own id',
    );

function answerIsAnOption(block: {
    options: { id: string }[];
    answer: string;
}) {
    return block.options.some((option) => option.id === block.answer);
}

const answerError = {
    path: ['answer'],
    message: 'The answer must be one of the options',
};

const checkContent = z.object({
    prompt: screenText,
    illustration: illustration.optional(),
    diagram: diagram.optional(),
    options,
    answer: z.string(),
    reason: z
        .object({
            prompt: screenText,
            starters: z.array(z.string().trim().min(1)).min(1).max(3),
        })
        .optional(),
    praise: screenText,
    hints: z.tuple([picture, picture, picture]),
    example: picture,
    reveal: screenText,
});

export const blockContent = {
    brain_game: z.object({ game: z.enum(['memory_pairs']) }),
    hook: z.object({
        prompt: screenText,
        illustration: illustration.optional(),
        diagram: diagram.optional(),
        options,
    }),
    story: z.object({
        text: screenText,
        illustration: illustration.optional(),
        diagram: diagram.optional(),
        fraction: z
            .object({
                numerator: z.int().positive(),
                denominator: z.int().positive(),
                numeratorNote: z.string().trim().min(1),
                denominatorNote: z.string().trim().min(1),
            })
            .optional(),
    }),
    check: checkContent,
    challenge: z.object({
        prompt: screenText,
        question: screenText,
        illustration: illustration.optional(),
        diagram: diagram.optional(),
        options,
        answer: z.string(),
        reasonStarter: z.string().trim().min(1),
    }),
    reflection: z.object({
        topics: z.array(z.string().trim().min(1)).min(2).max(4),
        takeaways: z.array(screenText).min(1).max(3),
    }),
    extra_challenge: checkContent,
};

export const sessionBlock = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('brain_game'),
        content: blockContent.brain_game,
    }),
    z.object({ kind: z.literal('hook'), content: blockContent.hook }),
    z.object({ kind: z.literal('story'), content: blockContent.story }),
    z.object({
        kind: z.literal('check'),
        content: blockContent.check.refine(answerIsAnOption, answerError),
    }),
    z.object({
        kind: z.literal('challenge'),
        content: blockContent.challenge.refine(answerIsAnOption, answerError),
    }),
    z.object({
        kind: z.literal('reflection'),
        content: blockContent.reflection,
    }),
    z.object({
        kind: z.literal('extra_challenge'),
        content: blockContent.extra_challenge.refine(
            answerIsAnOption,
            answerError,
        ),
    }),
]);

export type SessionBlock = z.infer<typeof sessionBlock>;

export type DiagramPlace = { path: (string | number)[]; diagram: Diagram };

export function diagramsOf(block: SessionBlock): DiagramPlace[] {
    switch (block.kind) {
        case 'hook':
        case 'story':
        case 'challenge':
            return block.content.diagram
                ? [{ path: ['diagram'], diagram: block.content.diagram }]
                : [];
        case 'check':
        case 'extra_challenge':
            return [
                ...(block.content.diagram
                    ? [{ path: ['diagram'], diagram: block.content.diagram }]
                    : []),
                ...block.content.hints.flatMap((hint, i) =>
                    hint.diagram
                        ? [
                              {
                                  path: ['hints', i, 'diagram'],
                                  diagram: hint.diagram,
                              },
                          ]
                        : [],
                ),
                ...(block.content.example.diagram
                    ? [
                          {
                              path: ['example', 'diagram'],
                              diagram: block.content.example.diagram,
                          },
                      ]
                    : []),
            ];
        default:
            return [];
    }
}

export const optionIds = ({ content }: SessionBlock) =>
    'options' in content ? content.options.map(({ id }) => id).join(',') : '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export function withoutDiagrams<T>(content: T): T {
    const copy = structuredClone(content);
    if (!isRecord(copy)) return copy;

    const parents = [
        copy,
        ...(Array.isArray(copy.hints) ? copy.hints : []),
        copy.example,
    ];
    for (const parent of parents) if (isRecord(parent)) delete parent.diagram;

    return copy;
}

export function mergeDiagrams(base: SessionBlock, themed: unknown): unknown {
    const copy = structuredClone(themed);

    for (const { path, diagram } of diagramsOf(base)) {
        let parent: unknown = copy;
        for (const key of path.slice(0, -1))
            parent =
                typeof parent === 'object' && parent !== null
                    ? (parent as Record<string | number, unknown>)[key]
                    : undefined;
        if (isRecord(parent))
            parent[path[path.length - 1]] = structuredClone(diagram);
    }

    return copy;
}

export const withTheme = (base: SessionBlock, themed: unknown) =>
    sessionBlock.parse({
        kind: base.kind,
        content: mergeDiagrams(base, themed),
    });

const units = [
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
];
const numberWords = [
    'nol',
    ...units,
    'setengah',
    'separuh',
    '(?:se)?(?:belas|puluh|ratus|ribu)(?:an)?',
    `(?:se)?per(?:${units.slice(1).join('|')}|sepuluh)`,
];
const numberPattern = new RegExp(
    `\\d+(?:[.,]\\d+)?(?:\\/\\d+)?|(?<!\\p{L})(?:${numberWords.join('|')})(?!\\p{L})`,
    'giu',
);
const numberIdioms =
    /(?<!\p{L})(?:salah\s+satu|satu-satunya|satu\s+per\s+satu|dua-duanya)(?!\p{L})/giu;

function textsOf(value: unknown, key?: string): string[] {
    if (key === 'id' || key === 'answer' || key === 'diagram') return [];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap((item) => textsOf(item));
    if (isRecord(value))
        return Object.entries(value).flatMap(([k, v]) => textsOf(v, k));
    return [];
}

export const numbersIn = (texts: string[]) =>
    texts
        .flatMap(
            (text) =>
                text.replace(numberIdioms, ' ').match(numberPattern) ?? [],
        )
        .map((number) => number.toLowerCase())
        .sort();

export const numbersOf = ({ content }: SessionBlock) =>
    numbersIn(textsOf(content));

function tally(list: string[]) {
    const counts = new Map<string, number>();
    for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
}

const answerOf = ({ content }: SessionBlock) =>
    'answer' in content ? content.answer : undefined;

const fractionOf = ({ content }: SessionBlock) =>
    'fraction' in content && content.fraction
        ? `${content.fraction.numerator}/${content.fraction.denominator}`
        : undefined;

const hasReason = (block: SessionBlock) =>
    (block.kind === 'check' || block.kind === 'extra_challenge') &&
    block.content.reason !== undefined;

const listOf = (block: SessionBlock, key: 'topics' | 'takeaways') =>
    block.kind === 'reflection' ? block.content[key].length : 0;

const counted = (count: number, word: string) =>
    `${count} ${count === 1 ? word : `${word}s`}`;

export function themeProblems(
    base: SessionBlock,
    themed: SessionBlock,
): string[] {
    const problems: string[] = [];
    const ids = optionIds(base);
    if (ids !== optionIds(themed))
        problems.push(
            `Keep the option ids ${ids.split(',').join(', ')} in this order`,
        );
    const answer = answerOf(base);
    if (answer !== answerOf(themed)) problems.push(`Keep the answer ${answer}`);
    const fraction = fractionOf(base);
    if (fraction !== fractionOf(themed))
        problems.push(
            fraction
                ? `Keep the fraction ${fraction}`
                : 'Remove the fraction; the base screen does not have one',
        );
    if (hasReason(base) !== hasReason(themed))
        problems.push(
            hasReason(base)
                ? 'Keep the reason question'
                : 'Remove the reason question; the base screen does not have one',
        );
    for (const [key, word] of [
        ['topics', 'topic'],
        ['takeaways', 'takeaway'],
    ] as const)
        if (listOf(base, key) !== listOf(themed, key))
            problems.push(`Keep ${counted(listOf(base, key), word)}`);
    const baseNumbers = tally(numbersOf(base));
    const themedNumbers = tally(numbersOf(themed));
    const missing = [...baseNumbers.keys()].filter(
        (number) => !themedNumbers.has(number),
    );
    const extra = [...themedNumbers.keys()].filter(
        (number) => !baseNumbers.has(number),
    );
    if (missing.length > 0)
        problems.push(
            missing.length === 1
                ? `Keep the number ${missing[0]} exactly as the base writes it`
                : `Keep the numbers ${missing.join(', ')} exactly as the base writes them`,
        );
    if (extra.length > 0)
        problems.push(
            extra.length === 1
                ? `Remove the number ${extra[0]}; the base screen does not have it`
                : `Remove the numbers ${extra.join(', ')}; the base screen does not have them`,
        );
    for (const [number, count] of baseNumbers) {
        const used = themedNumbers.get(number);
        if (used !== undefined && used !== count)
            problems.push(
                `Write the number ${number} exactly ${counted(count, 'time')} on this screen, as the base does (you wrote it ${counted(used, 'time')})`,
            );
    }

    return problems.map((problem) => `Theme rule: ${problem}`);
}

export const steps = ['opening', 'story', 'challenge', 'reflection'] as const;

export const stepOfKind = {
    brain_game: 'opening',
    hook: 'opening',
    story: 'story',
    check: 'story',
    challenge: 'challenge',
    reflection: 'reflection',
} satisfies Record<MissionKind, (typeof steps)[number]>;

export type MissionKind = Exclude<SessionBlock['kind'], 'extra_challenge'>;

export const isMissionKind = (
    kind: SessionBlock['kind'],
): kind is MissionKind => kind !== 'extra_challenge';

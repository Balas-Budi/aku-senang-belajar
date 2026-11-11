import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import {
    blockContent,
    diagram,
    diagramName,
    diagramsOf,
    isMissionKind,
    mergeDiagrams,
    numbersOf,
    optionIds,
    pathProblem,
    sessionBlock,
    type SessionBlock,
    textWidth,
    themeProblems,
    withoutDiagrams,
    withTheme,
} from '../src/learning/blocks.ts';
import {
    checkDraft,
    SESSION_SYSTEM_PROMPT,
    sessionDraft,
    withoutPictures,
} from '../src/studio/session-draft.ts';
import {
    allShapes,
    brokenDraft,
    draft,
    drawnDraft,
    quarters,
} from './studio-fixtures.ts';

const check = {
    kind: 'check',
    content: {
        prompt: 'This bread is cut into four. Is one piece a quarter?',
        options: [
            { id: 'a', label: 'Yes' },
            { id: 'b', label: 'No' },
        ],
        answer: 'b',
        praise: 'Right, the pieces must be the same size.',
        hints: [
            { text: 'A quarter is one of four equal parts.' },
            { text: 'Compare the sizes of the pieces.' },
            { text: 'Unequal pieces are not fair. Is that a quarter?' },
        ],
        example: {
            text: 'This paper is folded into four equal parts.',
            illustration: 'paper-quarters',
        },
        reveal: 'No, because the four pieces are not the same size.',
    },
};

function issuePaths(block: unknown) {
    const result = sessionBlock.safeParse(block);

    return result.success
        ? []
        : result.error.issues.map((issue) => issue.path.join('.'));
}

test('a check passes with its answer among the options and three hints', () => {
    assert.deepEqual(issuePaths(check), []);
});

test('a story screen may go without a picture, as an AI draft does', () => {
    assert.deepEqual(
        issuePaths({
            kind: 'story',
            content: { text: 'Kancil membagi roti menjadi empat bagian.' },
        }),
        [],
    );
});

test('a check whose answer is not one of its options is refused', () => {
    assert.deepEqual(
        issuePaths({ ...check, content: { ...check.content, answer: 'c' } }),
        ['content.answer'],
    );
});

const hook = {
    kind: 'hook',
    content: {
        prompt: 'Pernahkah kamu berbagi roti?',
        options: [
            { id: 'a', label: 'Pernah' },
            { id: 'b', label: 'Belum' },
        ],
    },
};

const story = {
    kind: 'story',
    content: { text: 'Kancil membagi roti menjadi empat bagian.' },
};

const challenge = {
    kind: 'challenge',
    content: {
        prompt: 'Ibu memotong semangka menjadi empat bagian sama besar.',
        question: 'Berapa bagian yang didapat Adi?',
        options: [
            { id: 'a', label: '1/4' },
            { id: 'b', label: '1/2' },
        ],
        answer: 'a',
        reasonStarter: 'Menurutku jawabannya',
    },
};

function places(diagram: unknown) {
    const [first, second, third] = check.content.hints;

    return {
        hook: { ...hook, content: { ...hook.content, diagram } },
        story: { ...story, content: { ...story.content, diagram } },
        check: { ...check, content: { ...check.content, diagram } },
        hint0: {
            ...check,
            content: {
                ...check.content,
                hints: [{ ...first, diagram }, second, third],
            },
        },
        hint1: {
            ...check,
            content: {
                ...check.content,
                hints: [first, { ...second, diagram }, third],
            },
        },
        hint2: {
            ...check,
            content: {
                ...check.content,
                hints: [first, second, { ...third, diagram }],
            },
        },
        example: {
            ...check,
            content: {
                ...check.content,
                example: { ...check.content.example, diagram },
            },
        },
        challenge: {
            ...challenge,
            content: { ...challenge.content, diagram },
        },
    };
}

for (const [name, drawing] of Object.entries({ quarters, allShapes })) {
    test(`every place takes ${name} and parses it back unchanged`, () => {
        for (const block of Object.values(places(drawing))) {
            assert.deepEqual(issuePaths(block), []);
            assert.deepEqual(sessionBlock.parse(block), block);
        }
    });

    test(`every place encodes ${name} without throwing`, () => {
        for (const block of Object.values(places(drawing))) {
            const kind = block.kind as keyof typeof blockContent;
            assert.doesNotThrow(() =>
                z.encode(
                    blockContent[kind],
                    blockContent[kind].parse(block.content),
                ),
            );
        }
    });
}

test('a diagram on an option is stripped', () => {
    const parsed = sessionBlock.parse({
        ...check,
        content: {
            ...check.content,
            options: [
                { id: 'a', label: 'Yes', diagram: quarters },
                { id: 'b', label: 'No' },
            ],
        },
    });

    assert.ok(parsed.kind === 'check');
    assert.deepEqual(parsed.content.options[0], { id: 'a', label: 'Yes' });
});

const [quarterLoaf, quarterText] = quarters.shapes;

function drawingPaths(diagram: unknown) {
    return issuePaths(places(diagram).story);
}

function withShapes(...shapes: unknown[]) {
    return drawingPaths({ label: quarters.label, shapes });
}

test('each diagram refusal points at its field', () => {
    const at = (path: string) => [`content.diagram.${path}`];
    const textAt = (fields: { text?: string; x?: number; y?: number }) =>
        drawingPaths({
            label: `${quarters.label} ${fields.text ?? ''}`,
            shapes: [quarterLoaf, { ...quarterText, x: 80, ...fields }],
        });

    assert.deepEqual(
        withShapes(...Array.from({ length: 41 }, () => quarterLoaf)),
        at('shapes'),
    );
    assert.deepEqual(withShapes({ ...quarterLoaf, x: 161 }), [
        ...at('shapes.0.x'),
        ...at('shapes.0.width'),
    ]);
    assert.deepEqual(
        withShapes({ ...quarterLoaf, x: 100, width: 80 }),
        at('shapes.0.width'),
    );
    assert.deepEqual(
        withShapes({ type: 'circle', cx: 10, cy: 60, r: 20, fill: 'paper' }),
        at('shapes.0.r'),
    );
    assert.deepEqual(
        withShapes({ ...quarterLoaf, type: 'star' }),
        at('shapes.0.type'),
    );
    assert.deepEqual(
        withShapes({ ...quarterLoaf, fill: 'red' }),
        at('shapes.0.fill'),
    );
    assert.deepEqual(
        withShapes({ type: 'rect', x: 10, y: 10, width: 20, height: 20 }),
        at('shapes.0.fill'),
    );
    assert.deepEqual(
        withShapes({
            type: 'line',
            x1: 10,
            y1: 10,
            x2: 50,
            y2: 10,
            stroke: 'blue',
        }),
        at('shapes.0.stroke'),
    );
    assert.deepEqual(
        withShapes({ type: 'line', x1: 10, y1: 10, x2: 10, y2: 10 }),
        at('shapes.0.x2'),
    );
    assert.deepEqual(textAt({ text: 'abcdefghijklm' }), at('shapes.1.text'));
    assert.deepEqual(textAt({ text: 'Ini satu.' }), at('shapes.1.text'));
    assert.deepEqual(textAt({ x: 5 }), at('shapes.1.x'));
    assert.deepEqual(textAt({ y: 5 }), at('shapes.1.y'));
    assert.deepEqual(textAt({ y: 115 }), at('shapes.1.y'));
    assert.deepEqual(textAt({ y: 6 }), []);
    assert.deepEqual(textAt({ y: 114 }), []);
    assert.deepEqual(
        withShapes(
            quarterLoaf,
            ...Array.from({ length: 7 }, (_, i) => ({
                ...quarterText,
                x: 20 + i * 20,
            })),
        ),
        at('shapes'),
    );
    assert.deepEqual(
        drawingPaths({ ...quarters, label: 'Roti dibagi empat sama besar.' }),
        [],
    );
    assert.deepEqual(
        drawingPaths({
            ...quarters,
            label: 'Roti dibagi empat, satu per empat, 1 / 4.',
        }),
        [],
    );
    assert.deepEqual(
        drawingPaths({ ...quarters, label: 'Roti 1/4.' }),
        at('label'),
    );
    assert.deepEqual(
        drawingPaths({ ...quarters, label: `1/4 ${'a'.repeat(197)}` }),
        at('label'),
    );
    assert.deepEqual(
        drawingPaths({
            ...quarters,
            label: 'Ini roti. Ada 4 bagian. Satu diwarnai 1/4.',
        }),
        [],
    );
    assert.deepEqual(
        drawingPaths({
            ...quarters,
            label: 'Ini roti. Ada 4 bagian. Satu diwarnai. Itu 1/4.',
        }),
        at('label'),
    );
    assert.deepEqual(
        withShapes(
            ...['mark', 'blue', 'green', 'yellow'].map((colour, i) => ({
                type: 'rect',
                x: 10 + i * 35,
                y: 10,
                width: 30,
                height: 30,
                fill: colour,
            })),
        ),
        at('shapes'),
    );
    assert.deepEqual(
        withShapes({ ...quarterLoaf, parts: undefined }),
        at('shapes.0.shaded'),
    );
    assert.deepEqual(
        withShapes({ ...quarterLoaf, shaded: 5 }),
        at('shapes.0.shaded'),
    );
    for (const fill of ['mark', 'blue'])
        assert.deepEqual(withShapes({ ...quarterLoaf, fill }), []);
    assert.deepEqual(
        withShapes({
            type: 'polygon',
            points: [
                [10, 10],
                [50, 50],
            ],
            fill: 'paper',
        }),
        at('shapes.0.points'),
    );
    assert.deepEqual(
        withShapes({
            type: 'path',
            d: 'M80 60 L80 15 A45 45 0 0 1 125 60 Z',
            fill: 'mark',
            stroke: 'mark',
        }),
        at('shapes.0.stroke'),
    );
    assert.deepEqual(
        withShapes({
            type: 'ellipse',
            cx: 80,
            cy: 50,
            rx: 60,
            ry: 30,
            fill: 'yellow',
            parts: 4,
            shaded: 1,
        }),
        [...at('shapes.0.parts'), ...at('shapes.0.shaded')],
    );
    assert.deepEqual(
        withShapes({ ...quarterLoaf, stroke: 'mark' }),
        at('shapes.0.stroke'),
    );
    assert.deepEqual(
        withShapes(
            quarterLoaf,
            ...['blue', 'green'].map((colour, i) => ({
                type: 'rect',
                x: 20 + i * 70,
                y: 90,
                width: 50,
                height: 20,
                fill: colour,
            })),
        ),
        at('shapes'),
    );
    assert.deepEqual(textAt({ text: '1/2 > 1/4' }), []);
});

test('a text past the edge is told the x range its width allows', () => {
    const result = diagram.safeParse({
        label: 'Garis bilangan dari 0 sampai 1 m.',
        shapes: [{ type: 'text', x: 150, y: 60, text: '1 m' }],
    });

    assert.equal(result.success, false);
    assert.equal(
        result.error?.issues[0]?.message,
        'text "1 m" is about 26 units wide, so with anchor "middle" x must be from 13 to 147',
    );
});

test('a diagram is named by its label, with any text the label leaves out', () => {
    const shapes = [
        { type: 'text', x: 40, y: 60, text: '1/4' },
        { type: 'text', x: 110, y: 60, text: '1 / 2' },
    ] as const;

    assert.equal(
        diagramName({
            label: 'Pita dibagi empat, 1/2 dan 1/4.',
            shapes: [...shapes],
        }),
        'Pita dibagi empat, 1/2 dan 1/4.',
    );
    assert.equal(
        diagramName({
            label: 'Pita dibagi empat sama panjang',
            shapes: [...shapes],
        }),
        'Pita dibagi empat sama panjang. Tulisan di gambar: 1/4, 1 / 2.',
    );
    assert.equal(textWidth('12 cm'), 44);
});

test('a huge label is refused at once, without the label checks', () => {
    const started = performance.now();
    const result = diagram.safeParse({
        label: `a${' '.repeat(200_000)}b`,
        shapes: Array.from({ length: 6 }, () => ({
            type: 'text',
            x: 80,
            y: 60,
            text: '1',
        })),
    });

    assert.equal(result.success, false);
    assert.deepEqual(
        result.error?.issues.map(({ path }) => path.join('.')),
        ['label'],
    );
    assert.ok(performance.now() - started < 500);
});

test('pathProblem refuses all but plain absolute paths inside the canvas', () => {
    const refusals: [string, RegExp][] = [
        ['m10 10 l5 5', /capital commands/],
        ['L10 10', /must start with M/],
        ['M10', /M takes 2 numbers/],
        ['M0 0 L200 10', /outside the 160 by 120 canvas/],
        ['M0 0 A10 10 0 2 1 20 20', /flags are 0 or 1/],
        ['M0 0 url(x)', /capital commands/],
        ['M1e3 0', /capital commands/],
        [`M0 0${' L1 1'.repeat(30)}`, /at most 30 commands/],
    ];

    for (const [d, problem] of refusals)
        assert.match(pathProblem(d) ?? '', problem, d);
    assert.equal(pathProblem('M80 60 L80 15 A45 45 0 0 1 125 60 Z'), null);
});

test('diagramsOf lists every place in order', () => {
    const found = drawnDraft.blocks.flatMap((block, index) =>
        diagramsOf(sessionBlock.parse(block)).map(
            ({ path }) => `${index}:${path.join('.')}`,
        ),
    );

    assert.deepEqual(found, [
        '0:diagram',
        '1:diagram',
        '2:diagram',
        '2:hints.1.diagram',
        '2:example.diagram',
        '5:diagram',
    ]);
});

test('withoutPictures keeps every diagram', () => {
    assert.deepEqual(withoutPictures(drawnDraft), drawnDraft);
});

test("the drafting prompt's example story diagram passes the diagram rules", () => {
    const line = SESSION_SYSTEM_PROMPT.split('\n').find((text) =>
        text.startsWith('{"kind": "story"'),
    );

    assert.ok(line);

    const story = JSON.parse(line.replace(/,$/, ''));

    assert.deepEqual(
        diagram.parse(story.content.diagram),
        story.content.diagram,
    );
});

const drafted = (value: unknown) =>
    checkDraft(['C1', 'C2'], [1, 2, 3, 4])(sessionDraft.parse(value));

test('checkDraft keeps the old text when a draft has one problem', () => {
    assert.equal(drafted(draft), null);
    assert.equal(drafted(drawnDraft), null);
    assert.equal(
        drafted({
            ...draft,
            blocks: draft.blocks.filter(
                (block) =>
                    !(block.kind === 'check' && block.competencies[0] === 'C1'),
            ),
        }),
        'C1 has no check or challenge that tests it',
    );
    assert.equal(
        drafted({
            ...draft,
            blocks: draft.blocks.map((block, index) =>
                index === 1 ? { ...block, pages: [9] } : block,
            ),
        }),
        'Block 2 (story) names page 9, which is not among the pages you received',
    );
});

test('checkDraft lists every broken block under one heading', () => {
    assert.deepEqual(drafted(brokenDraft)?.split('\n'), [
        'Fix every problem below:',
        '- Block 2 (story): diagram.shapes.0.width x + width must be at most 160',
        '- Block 3 (check): hints.1.diagram.label must be at most three sentences',
    ]);
});

test('checkDraft shows four problems of a block and counts the rest of that block', () => {
    const names = ['Ani', 'Budi', 'Cici', 'Dodi', 'Eka', 'Fajar'];
    const crowded = {
        label: quarters.label,
        shapes: names.map((text, i) => ({
            type: 'text',
            x: 5,
            y: 15 + i * 18,
            text,
        })),
    };
    const lines = drafted({
        ...drawnDraft,
        blocks: drawnDraft.blocks.map((block, index) =>
            index === 1
                ? { ...block, content: { ...block.content, diagram: crowded } }
                : block,
        ),
    })?.split('\n');

    assert.equal(lines?.length, 6);
    assert.equal(lines?.[0], 'Fix every problem below:');
    assert.match(lines?.[1] ?? '', /^- Block 2 \(story\): .*"Ani"/);
    assert.equal(
        lines?.[5],
        '- Block 2 (story): and 2 more problems in this block; check all of it against the rules',
    );
});

test('checkDraft takes twelve diagrams in a misi and refuses thirteen', () => {
    const everyPlace = {
        diagram: quarters,
        hints: [
            { text: 'Lihat besar setiap potongan.', diagram: quarters },
            { text: 'Bandingkan potongannya.', diagram: quarters },
            { text: 'Perempat semuanya sama besar.', diagram: quarters },
        ],
        example: { text: 'Kue dipotong empat sama besar.', diagram: quarters },
    };
    const drawnAt = (extra: Record<number, object>) => ({
        ...drawnDraft,
        blocks: drawnDraft.blocks.map((block, index) => ({
            ...block,
            content: { ...block.content, ...extra[index] },
        })),
    });

    assert.equal(
        drafted(drawnAt({ 3: { diagram: quarters }, 4: everyPlace })),
        null,
    );
    assert.equal(
        drafted(drawnAt({ 2: everyPlace, 4: everyPlace })),
        'The misi has 13 diagrams; keep at most 12, only where a picture explains better than words',
    );
});

test('checkDraft shows eight problems and counts the rest', () => {
    const lines = drafted({
        ...draft,
        blocks: draft.blocks.map((block) => ({
            ...block,
            competencies: ['C9'],
            pages: [99],
        })),
    })?.split('\n');

    assert.equal(lines?.length, 10);
    assert.equal(lines?.[0], 'Fix every problem below:');
    assert.equal(
        lines?.[1],
        '- Block 1 (hook) names C9, which is not among the competencies you received',
    );
    assert.equal(lines?.[9], '- and 9 more of the same kinds');
});

test('a screen of more than two sentences is refused', () => {
    assert.deepEqual(
        issuePaths({
            ...check,
            content: {
                ...check.content,
                prompt: 'Look at the bread. Count the pieces. Is one a quarter?',
            },
        }),
        ['content.prompt'],
    );

    const result = sessionBlock.safeParse({
        ...check,
        content: { ...check.content, prompt: 'Satu. Dua. Tiga? Empat!' },
    });

    assert.match(
        result.error?.issues[0]?.message ?? '',
        /^A student screen holds at most two sentences; this one has 4,/,
    );
});

const parsed = (block: unknown) => sessionBlock.parse(block);
const drawnCheck = parsed(drawnDraft.blocks[2]);
const kancil = parsed(draft.blocks[1]);
const rewritten = (block: SessionBlock, content: object) =>
    parsed({ kind: block.kind, content: { ...block.content, ...content } });

test('optionIds lists the option ids in order, empty without options', () => {
    assert.equal(optionIds(parsed(check)), 'a,b');
    assert.equal(optionIds(kancil), '');
});

test('withoutDiagrams removes every diagram and leaves the original whole', () => {
    const content = withoutDiagrams(drawnCheck.content) as Record<
        string,
        unknown
    >;

    assert.deepEqual(
        diagramsOf(parsed({ kind: 'check', content })).map(({ path }) =>
            path.join('.'),
        ),
        [],
    );
    assert.equal(content.prompt, 'Roti mana yang dibagi empat sama besar?');
    assert.equal(diagramsOf(drawnCheck).length, 3);
});

test('withTheme merges the base diagrams back, a hint diagram included', () => {
    const themed = {
        ...withoutDiagrams(drawnCheck.content),
        prompt: 'Bola mana yang dibagi empat sama besar?',
    };
    const block = withTheme(drawnCheck, themed);

    assert.equal(block.kind, 'check');
    assert.equal(
        block.kind === 'check' && block.content.prompt,
        'Bola mana yang dibagi empat sama besar?',
    );
    assert.deepEqual(diagramsOf(block), diagramsOf(drawnCheck));
    assert.equal(
        block.kind === 'check' && block.content.hints[1].diagram?.label,
        quarters.label,
    );
});

test('an extra challenge parses as a check and refuses an answer outside its options', () => {
    assert.equal(blockContent.extra_challenge, blockContent.check);
    assert.deepEqual(issuePaths({ ...check, kind: 'extra_challenge' }), []);
    assert.deepEqual(
        issuePaths({
            kind: 'extra_challenge',
            content: { ...check.content, answer: 'c' },
        }),
        ['content.answer'],
    );
});

test('an extra challenge lists its diagrams and keeps its reason question under a theme', () => {
    const extra = parsed({ ...drawnCheck, kind: 'extra_challenge' });
    const reason = {
        prompt: 'Mengapa begitu?',
        starters: ['Karena'],
    };

    const plain = rewritten(extra, { reason: undefined });

    assert.equal(extra.kind, 'extra_challenge');
    assert.deepEqual(diagramsOf(extra), diagramsOf(drawnCheck));
    assert.deepEqual(themeProblems(rewritten(extra, { reason }), plain), [
        'Theme rule: Keep the reason question',
    ]);
    assert.deepEqual(themeProblems(plain, rewritten(extra, { reason })), [
        'Theme rule: Remove the reason question; the base screen does not have one',
    ]);
});

test('isMissionKind leaves out only the extra challenge', () => {
    assert.deepEqual(
        sessionBlock.options
            .map((option) => option.shape.kind.value)
            .filter((kind) => !isMissionKind(kind)),
        ['extra_challenge'],
    );
});

test('mergeDiagrams never throws on malformed content', () => {
    for (const content of [
        null,
        'text',
        7,
        [],
        { hints: 'none' },
        { hints: [null, 5, 'x'] },
        { example: 3 },
    ])
        assert.doesNotThrow(() => mergeDiagrams(drawnCheck, content));

    assert.equal(mergeDiagrams(drawnCheck, null), null);
    assert.deepEqual(mergeDiagrams(drawnCheck, { hints: [null, 5] }), {
        hints: [null, 5],
        diagram: allShapes,
    });
});

test('numbersOf takes digits and number words, never ids or the answer', () => {
    assert.deepEqual(numbersOf(kancil), ['satu', 'tiga']);
    assert.deepEqual(
        numbersOf(
            rewritten(kancil, {
                text: 'Dua Belas anak makan sepertiga kue. Lalu 2,5 dan 3/4 sisanya.',
            }),
        ),
        ['2,5', '3/4', 'belas', 'dua', 'sepertiga'],
    );
    assert.deepEqual(numbersOf(parsed(draft.blocks[5])), [
        '1/2',
        '1/4',
        'empat',
    ]);
});

test('numbersOf skips phrases that only look like numbers and takes prefixed number words', () => {
    assert.deepEqual(
        numbersOf(
            rewritten(kancil, {
                text: 'Salah satu pemain, satu-satunya kiper, dan dua-duanya maju satu per satu.',
            }),
        ),
        [],
    );
    assert.deepEqual(
        numbersOf(
            rewritten(kancil, {
                text: 'Seratus penonton dan ribuan suporter makan seperlima atau seperdelapan kue, dua pertiga sisanya, puluhan bola.',
            }),
        ),
        [
            'dua',
            'pertiga',
            'puluhan',
            'ribuan',
            'seperdelapan',
            'seperlima',
            'seratus',
        ],
    );
});

test('themeProblems says how often to write a number the base already has', () => {
    assert.deepEqual(
        themeProblems(
            kancil,
            rewritten(kancil, {
                text: 'Kancil punya satu roti. Satu temannya datang, lalu tiga temannya.',
            }),
        ),
        [
            'Theme rule: Write the number satu exactly 1 time on this screen, as the base does (you wrote it 2 times)',
        ],
    );
});

test('themeProblems accepts a theme that keeps every number and answer', () => {
    assert.deepEqual(
        themeProblems(
            kancil,
            rewritten(kancil, {
                text: 'Kucing punya satu bola. Ia ingin bermain dengan tiga temannya.',
            }),
        ),
        [],
    );
});

test('themeProblems refuses "tiga temannya" rewritten as "dua temannya"', () => {
    assert.deepEqual(
        themeProblems(
            kancil,
            rewritten(kancil, {
                text: 'Kancil punya satu roti. Ia ingin berbagi dengan dua temannya.',
            }),
        ),
        [
            'Theme rule: Keep the number tiga exactly as the base writes it',
            'Theme rule: Remove the number dua; the base screen does not have it',
        ],
    );
});

test('themeProblems names an extra digit', () => {
    assert.deepEqual(
        themeProblems(
            kancil,
            rewritten(kancil, {
                text: 'Kancil punya satu roti. Pemain nomor 11 berbagi dengan tiga temannya.',
            }),
        ),
        ['Theme rule: Remove the number 11; the base screen does not have it'],
    );
});

test('themeProblems refuses changed ids, answer, fraction, reason, and lists', () => {
    const base = parsed(check);
    const fraction = {
        numerator: 1,
        denominator: 4,
        numeratorNote: 'bagian yang diambil',
        denominatorNote: 'semua bagian',
    };
    const story = rewritten(kancil, { fraction });
    const reflection = parsed(draft.blocks[6]);

    assert.deepEqual(
        themeProblems(
            base,
            rewritten(base, {
                options: [
                    { id: 'b', label: 'No' },
                    { id: 'a', label: 'Yes' },
                ],
                answer: 'a',
                reason: { prompt: 'Why?', starters: ['Because'] },
            }),
        ),
        [
            'Theme rule: Keep the option ids a, b in this order',
            'Theme rule: Keep the answer b',
            'Theme rule: Remove the reason question; the base screen does not have one',
        ],
    );
    assert.deepEqual(
        themeProblems(
            story,
            rewritten(story, { fraction: { ...fraction, denominator: 2 } }),
        ),
        ['Theme rule: Keep the fraction 1/4'],
    );
    assert.deepEqual(
        themeProblems(
            reflection,
            rewritten(reflection, {
                topics: ['Pecahan', 'Perempat', 'Bola'],
                takeaways: [
                    'Perempat berarti satu dari empat bagian sama besar.',
                    'Bola itu bulat.',
                ],
            }),
        ),
        ['Theme rule: Keep 2 topics', 'Theme rule: Keep 1 takeaway'],
    );
});

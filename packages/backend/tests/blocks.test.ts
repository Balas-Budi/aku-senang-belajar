import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sessionBlock } from '../src/learning/blocks.ts';

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

test('a check whose answer is not one of its options is refused', () => {
    assert.deepEqual(
        issuePaths({ ...check, content: { ...check.content, answer: 'c' } }),
        ['content.answer'],
    );
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
});

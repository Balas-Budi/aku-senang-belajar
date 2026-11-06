import type { StudioBlock } from './queries';

export type EditableBlock = Exclude<StudioBlock, { kind: 'brain_game' }>;
type Path = (string | number)[];
export type TextField = {
    path: Path;
    label: string;
    long: boolean;
    correct?: boolean;
};
type Node = Record<string | number, unknown>;

const text = (label: string, ...path: Path): TextField => ({
    path,
    label,
    long: true,
});
const line = (label: string, ...path: Path): TextField => ({
    path,
    label,
    long: false,
});
const optionFields = (options: { id: string }[], answer?: string) =>
    options.map((option, index) => ({
        ...line(`Pilihan ${index + 1}`, 'options', index, 'label'),
        correct: option.id === answer,
    }));

export const fieldName = ({ path }: TextField) =>
    ['content', ...path].join('/');

export function textFields(block: EditableBlock): TextField[] {
    switch (block.kind) {
        case 'hook':
            return [
                text('Pertanyaan', 'prompt'),
                ...optionFields(block.content.options),
            ];
        case 'story':
            return [text('Teks', 'text')];
        case 'check': {
            const { options, answer, reason, hints } = block.content;
            return [
                text('Pertanyaan', 'prompt'),
                ...optionFields(options, answer),
                ...(reason
                    ? [
                          text('Pertanyaan alasan', 'reason', 'prompt'),
                          ...reason.starters.map((_, index) =>
                              line(
                                  `Pembuka alasan ${index + 1}`,
                                  'reason',
                                  'starters',
                                  index,
                              ),
                          ),
                      ]
                    : []),
                ...hints.map((_, index) =>
                    text(`Petunjuk ${index + 1}`, 'hints', index, 'text'),
                ),
                text('Contoh lain', 'example', 'text'),
                text('Jawaban dan alasan', 'reveal'),
                text('Pujian', 'praise'),
            ];
        }
        case 'challenge':
            return [
                text('Situasi', 'prompt'),
                text('Pertanyaan', 'question'),
                ...optionFields(block.content.options, block.content.answer),
                line('Pembuka alasan', 'reasonStarter'),
            ];
        case 'reflection':
            return [
                ...block.content.topics.map((_, index) =>
                    line(`Topik ${index + 1}`, 'topics', index),
                ),
                ...block.content.takeaways.map((_, index) =>
                    text(`Yang diingat ${index + 1}`, 'takeaways', index),
                ),
            ];
    }
}

export function textAt(content: Node, { path }: TextField) {
    const value = path.reduce<unknown>(
        (node, key) => (node as Node)[key],
        content,
    );
    return typeof value === 'string' ? value : '';
}

export function withTexts(
    content: Node,
    fields: TextField[],
    read: (field: TextField) => string,
) {
    const copy = structuredClone(content);
    for (const field of fields) {
        const parent = field.path
            .slice(0, -1)
            .reduce<Node>((node, key) => node[key] as Node, copy);
        parent[field.path[field.path.length - 1]] = read(field);
    }
    return copy;
}

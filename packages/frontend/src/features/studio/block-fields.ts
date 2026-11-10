import type { Diagram } from '../learning-sessions/diagram';
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

const parentOf = (content: Node, path: Path) =>
    path.slice(0, -1).reduce<Node>((node, key) => node[key] as Node, content);

export function withTexts(
    content: Node,
    fields: TextField[],
    read: (field: TextField) => string,
) {
    const copy = structuredClone(content);
    for (const field of fields)
        parentOf(copy, field.path)[field.path[field.path.length - 1]] =
            read(field);
    return copy;
}

export type DiagramField = {
    path: Path;
    under: Path;
    name: string;
    diagram: Diagram;
};

const drawn = (
    name: string,
    diagram: Diagram | undefined,
    ...under: Path
): DiagramField[] =>
    diagram
        ? [{ path: [...under.slice(0, -1), 'diagram'], under, name, diagram }]
        : [];

export function diagramFields(block: EditableBlock): DiagramField[] {
    switch (block.kind) {
        case 'hook':
            return drawn('Gambar pertanyaan', block.content.diagram, 'prompt');
        case 'story':
            return drawn('Gambar cerita', block.content.diagram, 'text');
        case 'check': {
            const { diagram, hints, example } = block.content;
            return [
                ...drawn('Gambar pertanyaan', diagram, 'prompt'),
                ...hints.flatMap((hint, index) =>
                    drawn(
                        `Gambar petunjuk ${index + 1}`,
                        hint.diagram,
                        'hints',
                        index,
                        'text',
                    ),
                ),
                ...drawn(
                    'Gambar contoh lain',
                    example.diagram,
                    'example',
                    'text',
                ),
            ];
        }
        case 'challenge':
            return drawn('Gambar situasi', block.content.diagram, 'prompt');
        case 'reflection':
            return [];
    }
}

export const samePath = (a: Path, b: Path) => a.join('/') === b.join('/');

export function withoutDiagram(content: Node, path: Path) {
    const copy = structuredClone(content);
    delete parentOf(copy, path)[path[path.length - 1]];
    return copy;
}

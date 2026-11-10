import {
    diagramFields,
    samePath,
    textAt,
    textFields,
    type DiagramField,
} from './block-fields';
import { DiagramFigure } from './diagram-figure';
import type { StudioBlock } from './queries';

export function BlockView({
    block,
    onRemove,
}: {
    block: StudioBlock;
    onRemove?: (field: DiagramField) => void;
}) {
    if (block.kind === 'brain_game')
        return (
            <p className="text-muted-foreground">
                Permainan memori sebelum misi dimulai. Siswa boleh melewatinya,
                dan hasilnya tidak dihitung sebagai bukti.
            </p>
        );
    const diagrams = diagramFields(block);
    return (
        <dl className="space-y-3">
            {textFields(block).map((field) => (
                <div
                    key={field.path.join('/')}
                    className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4"
                >
                    <dt className="text-muted-foreground text-sm font-medium sm:pt-0.5">
                        {field.label}
                    </dt>
                    <dd className="text-pretty">
                        {textAt(block.content, field)}
                        {field.correct && (
                            <>
                                {' '}
                                <span className="text-status-visible ml-1 text-sm font-semibold">
                                    Jawaban benar
                                </span>
                            </>
                        )}
                        {diagrams
                            .filter((d) => samePath(d.under, field.path))
                            .map((d) => (
                                <DiagramFigure
                                    key={d.path.join('/')}
                                    name={d.name}
                                    screen={block.position}
                                    diagram={d.diagram}
                                    onRemove={
                                        onRemove ? () => onRemove(d) : undefined
                                    }
                                />
                            ))}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

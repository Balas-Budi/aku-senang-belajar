import { textAt, textFields } from './block-fields';
import type { StudioBlock } from './queries';

export function BlockView({ block }: { block: StudioBlock }) {
    if (block.kind === 'brain_game')
        return (
            <p className="text-muted-foreground">
                Permainan memori sebelum misi dimulai. Siswa boleh melewatinya,
                dan hasilnya tidak dihitung sebagai bukti.
            </p>
        );
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
                    </dd>
                </div>
            ))}
        </dl>
    );
}

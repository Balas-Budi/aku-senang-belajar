import { useId } from 'react';
import { Button } from '../../components/ui/button';
import {
    DiagramPicture,
    diagramName,
    type Diagram,
} from '../learning-sessions/diagram';

export function DiagramFigure({
    name,
    screen,
    diagram,
    onRemove,
}: {
    name: string;
    screen: number;
    diagram: Diagram;
    onRemove?: () => void;
}) {
    const captionId = useId();
    return (
        <figure className="mt-2 space-y-1">
            <DiagramPicture
                diagram={diagram}
                aria-labelledby={captionId}
                className="border-border bg-background max-w-80 rounded-lg border"
            />
            <figcaption id={captionId} className="text-sm">
                <span className="font-medium">{name} · buatan AI</span>
                <span className="text-muted-foreground block">
                    Dibacakan untuk siswa tunanetra: "{diagramName(diagram)}"
                </span>
            </figcaption>
            {onRemove && (
                <Button
                    variant="outline"
                    aria-label={`Hapus ${name.toLowerCase()} di layar ${screen}`}
                    onClick={onRemove}
                >
                    Hapus gambar
                </Button>
            )}
        </figure>
    );
}

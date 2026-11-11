import { DiagramPicture, type Diagram } from './diagram';
import { Illustration, type IllustrationName } from './illustration';

export function ScreenPicture({
    illustration,
    diagram,
    className,
}: {
    illustration?: IllustrationName;
    diagram?: Diagram;
    className?: string;
}) {
    return (
        <>
            {illustration && (
                <Illustration name={illustration} className={className} />
            )}
            {diagram && (
                <DiagramPicture diagram={diagram} className={className} />
            )}
        </>
    );
}

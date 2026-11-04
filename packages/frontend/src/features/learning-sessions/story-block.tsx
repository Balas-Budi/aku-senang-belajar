import { Button } from '../../components/ui/button';
import { Illustration } from './illustration';
import type { BlockOf } from './queries';
import { ScreenCard, ScreenHeading } from './session-ui';

type Fraction = NonNullable<BlockOf<'story'>['content']['fraction']>;

function FractionNote({ fraction }: { fraction: Fraction }) {
    return (
        <div className="bg-student-surface flex items-center gap-5 rounded-2xl p-4">
            <p className="font-display text-primary-deep flex flex-col items-center text-[2.4em] leading-none font-semibold">
                <span className="sr-only">
                    {fraction.numerator}/{fraction.denominator}
                </span>
                <span aria-hidden="true">{fraction.numerator}</span>
                <span
                    aria-hidden="true"
                    className="bg-primary-deep my-1.5 h-1 w-12 rounded-full"
                />
                <span aria-hidden="true">{fraction.denominator}</span>
            </p>
            <dl className="space-y-3">
                <div className="flex gap-3">
                    <dt className="font-display text-primary font-bold">
                        {fraction.numerator}
                    </dt>
                    <dd>{fraction.numeratorNote}</dd>
                </div>
                <div className="flex gap-3">
                    <dt className="font-display text-primary font-bold">
                        {fraction.denominator}
                    </dt>
                    <dd>{fraction.denominatorNote}</dd>
                </div>
            </dl>
        </div>
    );
}

export function StoryBlock({
    block,
    number,
    total,
    onNext,
}: {
    block: BlockOf<'story'>;
    number: number;
    total: number;
    onNext: () => void;
}) {
    const { content } = block;
    return (
        <ScreenCard aria-labelledby={`block-${block.id}`}>
            <ScreenHeading
                id={`block-${block.id}`}
                className="text-primary text-[1.1em]"
            >
                Cerita {number} dari {total}
            </ScreenHeading>
            <Illustration
                name={content.illustration}
                className="mx-auto max-w-sm"
            />
            <p className="font-display text-primary-deep text-[1.35em] leading-snug font-medium text-pretty">
                {content.text}
            </p>
            {content.fraction && <FractionNote fraction={content.fraction} />}
            <Button feel="chunky" className="w-full sm:w-auto" onClick={onNext}>
                Lanjut
            </Button>
        </ScreenCard>
    );
}

import { cn } from '../../lib/cn';
import { finished, type Stage } from './queries';

export function StageBar({
    stages,
    className,
}: {
    stages: Stage[];
    className?: string;
}) {
    return (
        <span className={cn('block', className)}>
            <span className="text-muted-foreground block text-base">
                {finished(stages)} dari {stages.length} misi selesai
            </span>
            <span aria-hidden="true" className="mt-1.5 flex max-w-xs gap-1">
                {stages.map((stage) => (
                    <span
                        key={stage.id}
                        className={cn(
                            'h-2 flex-1 rounded-full',
                            stage.progress === 'submitted'
                                ? 'bg-primary'
                                : 'bg-secondary',
                        )}
                    />
                ))}
            </span>
        </span>
    );
}

import type { ReactNode } from 'react';

export function PageHeader({
    title,
    description,
    children,
}: {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
                <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                    {title}
                </h1>
                {description && (
                    <p className="text-muted-foreground mt-2 text-lg">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </div>
    );
}

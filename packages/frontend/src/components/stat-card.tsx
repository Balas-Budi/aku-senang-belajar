import { Card } from './ui/card';

export function StatCard({
    label,
    value,
    note,
}: {
    label: string;
    value: number;
    note: string;
}) {
    return (
        <Card className="h-full">
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="mt-1 text-[2rem] leading-tight font-bold tabular-nums">
                {value}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{note}</p>
        </Card>
    );
}

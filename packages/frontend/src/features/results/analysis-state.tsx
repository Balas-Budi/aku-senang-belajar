import { Button } from '../../components/ui/button';
import { RequestError } from '../../components/request-error';
import {
    analysing,
    type Progress,
    type RunStatus,
    useAnalyseAgain,
} from './queries';

export function stateLabel(progress: Progress, analysis: RunStatus | null) {
    if (progress === 'not_started') return 'Belum mulai';
    if (progress === 'in_progress') return 'Sedang mengerjakan';
    if (analysing(analysis)) return 'Sedang dianalisis';
    if (analysis === 'succeeded') return 'Sudah dianalisis';

    return 'Menunggu analisis';
}

export function waitsForTeacher(
    progress: Progress,
    analysis: RunStatus | null,
) {
    return (
        progress === 'submitted' && (analysis === null || analysis === 'failed')
    );
}

export function AnalyseAgain({
    classId,
    attemptId,
    analysis,
    studentName,
}: {
    classId: number;
    attemptId: number;
    analysis: RunStatus | null;
    studentName?: string;
}) {
    const again = useAnalyseAgain(classId);

    return (
        <div className="space-y-2">
            <Button
                variant="outline"
                disabled={again.isPending}
                onClick={() => again.mutate(attemptId)}
            >
                {again.isPending
                    ? 'Mengirim…'
                    : analysis === 'failed'
                      ? 'Analisis ulang'
                      : 'Mulai analisis'}
                {studentName && (
                    <span className="sr-only"> untuk {studentName}</span>
                )}
            </Button>
            <RequestError error={again.error} />
        </div>
    );
}

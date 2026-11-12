import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { errorCode } from './queries';

const refusals: Record<string, string> = {
    CHALLENGE_OPEN:
        'Kelas ini sudah punya tantangan yang berjalan. Kartu ini menampilkannya.',
    CHALLENGE_STATE:
        'Tantangan sudah berubah. Kartu ini memuat keadaan terbarunya.',
    CLASS_EMPTY:
        'Kelas ini belum punya siswa. Bagikan kode kelas dulu, lalu mulai tantangan.',
    TOO_FEW_ANSWERS: 'Pengelompokan perlu setidaknya 3 jawaban.',
    AI_FAILED: 'AI belum bisa mengelompokkan alasan. Coba lagi sebentar lagi.',
};

export function ChallengeError({ error }: { error: unknown }) {
    const refusal = refusals[errorCode(error) ?? ''];
    if (!refusal) return <RequestError error={error} />;
    return (
        <Alert tone="attention" role="alert">
            {refusal}
        </Alert>
    );
}

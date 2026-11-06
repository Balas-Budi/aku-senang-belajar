import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { ApiError } from '../../lib/api';

export function StudioError({
    error,
    inline = [],
}: {
    error: unknown;
    inline?: string[];
}) {
    if (!(error instanceof ApiError)) return <RequestError error={error} />;
    const details = error.body.details ?? [];
    if (error.status === 502 || error.status === 503)
        return (
            <Alert tone="attention" role="alert">
                AI belum bisa menyusun sesi sekarang. Coba lagi sebentar lagi.
            </Alert>
        );
    if (error.status === 409)
        return (
            <Alert tone="attention" role="alert">
                {error.body.name === 'SESSION_PUBLISHED'
                    ? 'Sesi ini sudah ditugaskan, jadi isinya tidak bisa diubah lagi.'
                    : 'AI sedang menyusun sesi ini. Tunggu sampai selesai, lalu coba lagi.'}
            </Alert>
        );
    if (
        error.status === 400 &&
        details.length > 0 &&
        details.every(({ field }) => inline.includes(field))
    )
        return (
            <p role="alert" className="text-destructive">
                Teks belum tersimpan. Perbaiki isian yang ditandai.
            </p>
        );
    return <RequestError error={error} />;
}

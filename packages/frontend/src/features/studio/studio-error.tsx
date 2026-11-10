import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { ApiError } from '../../lib/api';

const conflicts: Record<string, string> = {
    SESSION_PUBLISHED:
        'Sesi ini sudah terbit, jadi isinya tidak bisa diubah lagi.',
    SESSION_NOT_READY: 'Terbitkan sesi ini dulu sebelum menugaskannya.',
    PUBLISH_BLOCKED:
        'Sesi ini belum bisa diterbitkan. Periksa daftar di atas tombol.',
    WARNINGS_NOT_ACKNOWLEDGED:
        'Peringatan sesi ini berubah. Centang lagi setiap peringatan, lalu terbitkan.',
    SESSION_CHANGED:
        'Draf sudah berubah sejak halaman ini dibuka. Periksa lagi setiap layar dan gambarnya, lalu centang dan terbitkan.',
};

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
                {conflicts[error.body.name] ??
                    'AI sedang menyusun sesi ini. Tunggu sampai selesai, lalu coba lagi.'}
            </Alert>
        );
    if (
        error.status === 400 &&
        details.length > 0 &&
        details.every(({ field }) => inline.includes(field))
    )
        return (
            <p role="alert" className="text-destructive">
                Belum tersimpan. Perbaiki isian yang ditandai, lalu coba lagi.
            </p>
        );
    return <RequestError error={error} />;
}

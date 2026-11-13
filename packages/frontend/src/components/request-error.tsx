import { useEffect, useRef } from 'react';
import { ApiError } from '../lib/api';
import { fieldLabel, fieldMessage } from '../lib/field-message';
import { useErrorToast } from './ui/toast';
export function requestErrorMessage(error: unknown) {
    return error instanceof ApiError && error.status === 401
        ? 'Nama pengguna atau kata sandi belum cocok.'
        : error instanceof ApiError && error.status === 429
          ? 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.'
          : error instanceof ApiError && error.status === 413
            ? 'Ukuran file melebihi batas. Gunakan file yang lebih kecil.'
            : 'Permintaan belum berhasil. Periksa koneksi dan isian, lalu coba lagi.';
}
function requestErrorText(error: unknown) {
    const details =
        error instanceof ApiError
            ? (error.body.details ?? []).map(
                  (item) =>
                      `${fieldLabel(item.field)}: ${fieldMessage(item.message, item.field)}`,
              )
            : [];
    return [requestErrorMessage(error), ...details].join(' ');
}
/**
 * Shows a failed request as a toast once per error; renders nothing in place.
 * `message` replaces the generic text for refusals a caller explains itself.
 */
export function ErrorToast({
    error,
    message,
}: {
    error: unknown;
    message?: string | null;
}) {
    const show = useErrorToast();
    const text = useRef<string | null>(null);
    text.current = error ? (message ?? requestErrorText(error)) : null;
    useEffect(() => {
        if (error && text.current) show(text.current);
    }, [error, show]);
    return null;
}
export function RequestError({ error }: { error: unknown }) {
    return <ErrorToast error={error} />;
}

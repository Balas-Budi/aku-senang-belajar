import { ApiError } from '../lib/api';
import { fieldLabel, fieldMessage } from '../lib/field-message';
export function requestErrorMessage(error: unknown) {
    return error instanceof ApiError && error.status === 401
        ? 'Nama pengguna atau kata sandi belum cocok.'
        : error instanceof ApiError && error.status === 429
          ? 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.'
          : error instanceof ApiError && error.status === 413
            ? 'Ukuran file melebihi batas. Gunakan file yang lebih kecil.'
            : 'Permintaan belum berhasil. Periksa koneksi dan isian, lalu coba lagi.';
}
export function RequestError({ error }: { error: unknown }) {
    if (!error) return null;
    return (
        <div
            role="alert"
            className="border-destructive text-destructive rounded-lg border p-4"
        >
            <p>{requestErrorMessage(error)}</p>
            {error instanceof ApiError &&
                error.body.details?.map((item) => (
                    <p
                        key={`${item.field}-${item.message}`}
                        className="mt-2 text-sm"
                    >
                        {fieldLabel(item.field)}:{' '}
                        {fieldMessage(item.message, item.field)}
                    </p>
                ))}
        </div>
    );
}

import type { Licence, LicenceData } from './queries';
import {
    FormField,
    TextAreaField,
    fieldErrorText,
} from '../../components/form-field';

export const licenceLabels: Record<Licence, string> = {
    own: 'Karya sendiri',
    school: 'Lisensi sekolah',
    open: 'Lisensi terbuka',
    permission: 'Izin tertulis',
};

const licences: Licence[] = ['own', 'school', 'open', 'permission'];

export const licenceOf = (value: FormDataEntryValue | null) =>
    licences.find((licence) => licence === value) ?? null;

export function LicenceFields({
    values,
    error,
}: {
    values?: LicenceData;
    error: unknown;
}) {
    const licenceError = fieldErrorText(error, 'licence');
    return (
        <>
            <FormField
                name="source"
                label="Sumber"
                maxLength={200}
                placeholder="Contoh: judul buku dan penerbitnya"
                defaultValue={values?.source ?? ''}
                error={error}
            />
            <div className="space-y-2">
                <label htmlFor="licence" className="block font-medium">
                    Jenis hak
                </label>
                <select
                    id="licence"
                    name="licence"
                    defaultValue={values?.licence ?? ''}
                    aria-invalid={licenceError !== null}
                    aria-describedby={
                        licenceError ? 'licence-error' : undefined
                    }
                    className="border-border bg-background focus-visible:outline-ring aria-invalid:border-destructive min-h-12 w-full rounded-lg border px-3 focus-visible:outline-3"
                >
                    <option value="">Belum diisi</option>
                    {licences.map((licence) => (
                        <option key={licence} value={licence}>
                            {licenceLabels[licence]}
                        </option>
                    ))}
                </select>
                {licenceError && (
                    <p id="licence-error" className="text-destructive">
                        {licenceError}
                    </p>
                )}
            </div>
            <TextAreaField
                name="licenceNote"
                label="Catatan hak pakai"
                rows={2}
                maxLength={300}
                defaultValue={values?.licenceNote ?? ''}
                error={error}
            />
        </>
    );
}

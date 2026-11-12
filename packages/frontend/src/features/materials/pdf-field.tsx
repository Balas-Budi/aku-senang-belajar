import type { ComponentProps } from 'react';
import { FormField } from '../../components/form-field';

export const pdfLimits =
    'PDF dengan teks yang bisa dipilih, paling besar 20 MB dan 300 halaman. Halaman hasil pindai tidak terbaca.';

export function PdfField(
    props: Pick<ComponentProps<typeof FormField>, 'error' | 'onChange'>,
) {
    return (
        <FormField
            name="pdf"
            label="File PDF"
            type="file"
            accept="application/pdf,.pdf"
            required
            {...props}
        />
    );
}

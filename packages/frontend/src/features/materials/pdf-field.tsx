import type { ComponentProps } from 'react';
import { FormField } from '../../components/form-field';

export const pdfLimits =
    'PDF paling besar 200 MB dan 300 halaman. Halaman tanpa teks, seperti hasil pindai, dibaca AI dari gambarnya.';

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

import { extractText, getDocumentProxy } from 'unpdf';
import { fieldError } from '../../lib/field-error.ts';

export const PDF_CONTENT_TYPE = 'application/pdf';
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 300;
const MIN_CHARACTERS = 20;

function readable(text: string) {
    const clean = text
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return clean.replace(/\s/g, '').length >= MIN_CHARACTERS ? clean : null;
}

export async function readPdfPages(file: Buffer) {
    const pdf = await getDocumentProxy(new Uint8Array(file)).catch(() => {
        throw fieldError('pdf', 'The file is not a PDF that can be read');
    });

    if (pdf.numPages > MAX_PAGES) {
        throw fieldError('pdf', `A PDF holds at most ${MAX_PAGES} pages`);
    }

    const { text } = await extractText(pdf);

    return text.map(readable);
}

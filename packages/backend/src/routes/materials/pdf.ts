import {
    extractText,
    getDocumentProxy,
    inspectPages,
    renderPageAsImage,
} from 'unpdf';
import { fieldError } from '../../lib/field-error.ts';

export const PDF_CONTENT_TYPE = 'application/pdf';
export const MAX_PDF_BYTES = 200 * 1024 * 1024;
const MAX_PAGES = 300;
const MIN_CHARACTERS = 20;
const FEW_CHARACTERS = 400;
const LARGE_PICTURE = 0.25;
const MAX_PICTURED = 150;
const RENDER_WIDTH = 1000;

export type PdfPage = { text: string | null; pictured: boolean };

function readable(text: string) {
    const clean = text
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return clean.replace(/\s/g, '').length >= MIN_CHARACTERS ? clean : null;
}

const open = (file: Buffer) => getDocumentProxy(new Uint8Array(file));

export async function checkPdf(file: Buffer) {
    const pdf = await open(file).catch(() => {
        throw fieldError('pdf', 'The file is not a PDF that can be read');
    });

    if (pdf.numPages > MAX_PAGES) {
        throw fieldError('pdf', `A PDF holds at most ${MAX_PAGES} pages`);
    }
}

// shortcut: inspectPages holds every page at once, about 2 GB for a 160 MB book; inspect page by page and free each one if the server runs short of memory
export async function readPdfPages(file: Buffer): Promise<PdfPage[]> {
    const pdf = await open(file);
    const { text } = await extractText(pdf);
    const { pages } = await inspectPages(pdf);
    let pictured = 0;

    return text.map((raw, index) => {
        const page = pages[index];
        const wanted =
            page !== undefined &&
            ((page.imageCount > 0 && page.textLength < FEW_CHARACTERS) ||
                page.imageCoverage >= LARGE_PICTURE ||
                page.textLength < MIN_CHARACTERS);

        if (wanted) pictured += 1;

        return {
            text: readable(raw),
            pictured: wanted && pictured <= MAX_PICTURED,
        };
    });
}

export async function renderPages(file: Buffer, numbers: number[]) {
    const pdf = await open(file);
    const images = new Map<number, string>();

    for (const number of numbers) {
        images.set(
            number,
            await renderPageAsImage(pdf, number, {
                width: RENDER_WIDTH,
                format: 'jpeg',
                quality: 0.75,
                toDataURL: true,
                canvasImport: () => import('@napi-rs/canvas'),
            }),
        );
    }

    return images;
}

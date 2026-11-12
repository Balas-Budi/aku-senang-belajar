const escape = (text: string) => text.replace(/[\\()]/g, (char) => `\\${char}`);

function pageStream(text: string) {
    if (text === '') return '';
    const lines = text
        .split('\n')
        .map(
            (line, index) =>
                `${index === 0 ? '' : '0 -16 Td '}(${escape(line)}) Tj`,
        )
        .join(' ');
    return `BT /F1 12 Tf 72 720 Td ${lines} ET`;
}

const picture =
    'q 300 0 0 300 150 300 cm BI /W 2 /H 2 /CS /G /BPC 8 ID \x00\xff\xff\x00 EI Q';

export function pdfOf(pages: string[], pictured: number[] = []): Buffer {
    const objects: string[] = [];
    const pageIds = pages.map((_, index) => 3 + index * 2);
    const fontId = 3 + pages.length * 2;
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    pages.forEach((text, index) => {
        const id = pageIds[index];
        const stream = [
            pageStream(text),
            pictured.includes(index + 1) ? picture : '',
        ]
            .filter(Boolean)
            .join('\n');
        objects[id] =
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
            `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${id + 1} 0 R >>`;
        objects[id + 1] =
            `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
    });
    objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    let body = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id++) {
        offsets[id] = Buffer.byteLength(body, 'latin1');
        body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xref = Buffer.byteLength(body, 'latin1');
    body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++) {
        body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    return Buffer.from(body, 'latin1');
}

import { readSheet } from 'read-excel-file/node';
import { fieldError } from '../../lib/field-error.ts';

export const XLSX_CONTENT_TYPE =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const HEADERS = {
    name: ['nama', 'nama lengkap', 'name'],
    username: ['username', 'nama pengguna'],
    password: ['password', 'kata sandi'],
};

type SheetRow = { name: string; username: string; password?: string };

function text(cell: unknown): string {
    return typeof cell === 'string' || typeof cell === 'number'
        ? String(cell).trim()
        : '';
}

function columnOf(header: string[], aliases: string[]): number {
    return header.findIndex((title) => aliases.includes(title));
}

export async function readUserRows(file: Buffer): Promise<SheetRow[]> {
    // shortcut: no cap on the unzipped size; fine while only admins upload, add one before teachers can.
    const rows = await readSheet(file).catch(() => {
        throw fieldError(
            'file',
            'The file is not a readable .xlsx spreadsheet',
        );
    });

    const [first = [], ...body] = rows;
    const header = first.map((cell) => text(cell).toLowerCase());
    const name = columnOf(header, HEADERS.name);
    const username = columnOf(header, HEADERS.username);
    const password = columnOf(header, HEADERS.password);

    if (name === -1 || username === -1) {
        throw fieldError(
            'file',
            'The first row needs the columns "Nama" and "Username"',
        );
    }

    return body
        .filter((row) => row.some((cell) => text(cell) !== ''))
        .map((row) => {
            const typedPassword = password === -1 ? '' : text(row[password]);

            return {
                name: text(row[name]),
                username: text(row[username]),
                ...(typedPassword ? { password: typedPassword } : {}),
            };
        });
}

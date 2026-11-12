import { sql } from 'drizzle-orm';
import { materialPages } from '../db/schema.ts';

export const VISUAL_MARK = '[Isi gambar]';

export const pageContent = sql<
    string | null
>`nullif(concat_ws(E'\n\n', ${materialPages.text}, ${VISUAL_MARK} || ' ' || ${materialPages.visual}), '')`;

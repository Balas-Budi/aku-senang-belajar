import { createDatabase } from '../db/index.ts';
import { loadEnv } from '../env.ts';
import { mathsBook } from '../learning/maths-book.ts';
import { seedBook } from '../learning/seed-book.ts';

const { db, pool } = createDatabase(loadEnv().DATABASE_URL);

try {
    const { created } = await seedBook(db, mathsBook);

    console.log(
        created
            ? `"${mathsBook.material}" added to the shared library`
            : `"${mathsBook.material}" is already in the shared library`,
    );
} finally {
    await pool.end();
}

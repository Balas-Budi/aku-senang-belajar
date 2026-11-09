import { createDatabase } from '../db/index.ts';
import { loadEnv } from '../env.ts';
import {
    chunkStoredMaterials,
    retryFailedChunks,
} from '../materials/chunks.ts';

const { db, pool } = createDatabase(loadEnv().DATABASE_URL);

try {
    const chunked = await chunkStoredMaterials(db);
    const retried = await retryFailedChunks(db);

    console.log(
        `Split ${chunked} uploaded materials into chunks and gave ${retried} failed chunks new tries; the backend embeds them in the background`,
    );
} finally {
    await pool.end();
}

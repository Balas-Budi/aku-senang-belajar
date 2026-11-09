import { createDatabase } from '../db/index.ts';
import { loadEnv } from '../env.ts';
import {
    queueMissingSummaries,
    retryFailedSummaries,
} from '../memory/summaries.ts';

const { db, pool } = createDatabase(loadEnv().DATABASE_URL);

try {
    const queued = await queueMissingSummaries(db);
    const retried = await retryFailedSummaries(db);

    console.log(
        `Queued ${queued} summaries of missions analysed before learner memory and gave ${retried} failed summaries new tries; the backend writes them in the background`,
    );
} finally {
    await pool.end();
}

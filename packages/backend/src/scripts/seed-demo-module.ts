import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDatabase } from '../db/index.ts';
import { classes } from '../db/schema.ts';
import { loadEnv } from '../env.ts';
import { demoModule } from '../learning/demo-module.ts';
import { seedModule } from '../learning/seed-module.ts';

const classId = z.coerce.number().int().positive().safeParse(process.argv[2]);

if (!classId.success) {
    console.error(
        'Usage: npm exec nx run backend:seed-demo-module -- <class id>',
    );
    process.exit(1);
}

const { db, pool } = createDatabase(loadEnv().DATABASE_URL);

try {
    const [classroom] = await db
        .select({ name: classes.name })
        .from(classes)
        .where(eq(classes.id, classId.data));

    if (!classroom) {
        console.error(`Class ${classId.data} does not exist`);
        process.exitCode = 1;
    } else {
        const { assigned } = await seedModule(db, classId.data, demoModule);

        console.log(
            assigned
                ? `Demo module assigned to ${classroom.name}`
                : `${classroom.name} already has the demo module`,
        );
    }
} finally {
    await pool.end();
}

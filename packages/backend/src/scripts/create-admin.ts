import { generatePassword } from '../auth/codes.ts';
import { hashPassword } from '../auth/password.ts';
import { createDatabase } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { loadEnv } from '../env.ts';
import { isUniqueViolation } from '../lib/unique-violation.ts';
import {
    personName,
    username as usernameSchema,
} from '../routes/auth/schema.ts';

const ADMIN_PASSWORD_LENGTH = 20;
const [rawUsername = '', ...nameParts] = process.argv.slice(2);
const username = usernameSchema.safeParse(rawUsername);
const name = personName.safeParse(nameParts.join(' '));

if (!username.success || !name.success) {
    console.error(
        'Usage: npm exec nx run backend:create-admin -- <username> <full name>',
    );
    console.error(
        'The username takes 3 to 32 letters, digits, dots, dashes, or underscores.',
    );
    process.exit(1);
}

const { db, pool } = createDatabase(loadEnv().DATABASE_URL);
const password = generatePassword(ADMIN_PASSWORD_LENGTH);

try {
    await db.insert(users).values({
        role: 'admin',
        name: name.data,
        username: username.data,
        passwordHash: await hashPassword(password),
    });
    console.log(
        `Admin ${username.data} created. Password, shown only now: ${password}`,
    );
} catch (error) {
    if (!isUniqueViolation(error)) {
        throw error;
    }

    console.error(`The username ${username.data} is already taken`);
    process.exitCode = 1;
} finally {
    await pool.end();
}

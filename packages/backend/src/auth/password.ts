import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { AssertionError } from '../lib/errors.ts';

type Cost = { memory: number; passes: number; parallelism: number };

const CURRENT: Cost = { memory: 19456, passes: 2, parallelism: 1 };
const PHC =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function derive(
    password: string,
    salt: Buffer,
    cost: Cost,
    tagLength: number,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        argon2(
            'argon2id',
            {
                message: password.normalize('NFKC'),
                nonce: salt,
                tagLength,
                ...cost,
            },
            (error, tag) => (error ? reject(error) : resolve(tag)),
        );
    });
}

function base64(buffer: Buffer): string {
    return buffer.toString('base64').replace(/=+$/, '');
}

function parse(stored: string) {
    const match = PHC.exec(stored);

    if (!match) {
        throw new AssertionError(
            'Stored password hash is not an argon2id PHC string',
        );
    }

    const [, memory, passes, parallelism, salt, tag] = match;

    return {
        cost: {
            memory: Number(memory),
            passes: Number(passes),
            parallelism: Number(parallelism),
        },
        salt: Buffer.from(salt, 'base64'),
        tag: Buffer.from(tag, 'base64'),
    };
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const tag = await derive(password, salt, CURRENT, 32);
    const { memory, passes, parallelism } = CURRENT;

    return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${base64(salt)}$${base64(tag)}`;
}

export async function verifyPassword(
    stored: string,
    password: string,
): Promise<boolean> {
    const { cost, salt, tag } = parse(stored);
    const candidate = await derive(password, salt, cost, tag.length);

    return timingSafeEqual(candidate, tag);
}

export function needsRehash(stored: string): boolean {
    const { cost } = parse(stored);

    return (
        cost.memory !== CURRENT.memory ||
        cost.passes !== CURRENT.passes ||
        cost.parallelism !== CURRENT.parallelism
    );
}

export const dummyHash = await hashPassword(randomBytes(16).toString('hex'));

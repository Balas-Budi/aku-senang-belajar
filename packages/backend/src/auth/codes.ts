import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LOWER = 'abcdefghjkmnpqrstuvwxyz23456789';
export const INVITE_CODE_LENGTH = 6;

function randomFrom(alphabet: string, length: number): string {
    let value = '';

    for (let i = 0; i < length; i += 1) {
        value += alphabet[randomInt(alphabet.length)];
    }

    return value;
}

export function newInviteCode(): string {
    return randomFrom(UPPER, INVITE_CODE_LENGTH);
}

export function generatePassword(length: number): string {
    return randomFrom(LOWER, length);
}

export function normalizeCode(input: string): string {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

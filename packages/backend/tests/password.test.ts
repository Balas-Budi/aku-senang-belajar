import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    hashPassword,
    needsRehash,
    verifyPassword,
} from '../src/auth/password.ts';

test('a hash verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('a long enough passphrase');

    assert.equal(
        await verifyPassword(stored, 'a long enough passphrase'),
        true,
    );
    assert.equal(await verifyPassword(stored, 'a different passphrase'), false);
});

test('two hashes of one password differ', async () => {
    assert.notEqual(
        await hashPassword('identical input'),
        await hashPassword('identical input'),
    );
});

test('composed and decomposed unicode verify as the same password', async () => {
    const stored = await hashPassword('caf\u00e9 au lait');

    assert.equal(await verifyPassword(stored, 'cafe\u0301 au lait'), true);
});

test('a hash made with older parameters needs a rehash, a fresh one does not', async () => {
    const fresh = await hashPassword('a long enough passphrase');
    const older = fresh.replace('m=19456,t=2,p=1', 'm=7168,t=5,p=1');

    assert.equal(needsRehash(fresh), false);
    assert.equal(needsRehash(older), true);
});

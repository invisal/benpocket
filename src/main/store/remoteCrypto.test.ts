import { describe, expect, it } from 'vitest';
import { randomBytes } from 'crypto';
import { decryptPatch, encryptPatch } from './remoteCrypto';

function dek(): Buffer {
  return randomBytes(32);
}

describe('encryptPatch / decryptPatch', () => {
  it('round-trips plaintext through encrypt then decrypt', () => {
    const key = dek();
    const plaintext = Buffer.from('hello yjs update');
    const wire = encryptPatch(key, 'doc-1', plaintext);
    expect(decryptPatch(key, 'doc-1', wire)).toEqual(plaintext);
  });

  it('throws when decrypting with the wrong DEK', () => {
    const wire = encryptPatch(dek(), 'doc-1', Buffer.from('secret'));
    expect(() => decryptPatch(dek(), 'doc-1', wire)).toThrow();
  });

  it('throws when the ciphertext has been tampered with', () => {
    const key = dek();
    const wire = encryptPatch(key, 'doc-1', Buffer.from('secret'));
    const tampered = Buffer.from(wire, 'base64');
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptPatch(key, 'doc-1', tampered.toString('base64'))).toThrow();
  });

  it('throws when decrypted under a different docKey (AAD binding)', () => {
    const key = dek();
    const wire = encryptPatch(key, 'doc-1', Buffer.from('secret'));
    expect(() => decryptPatch(key, 'doc-2', wire)).toThrow();
  });
});

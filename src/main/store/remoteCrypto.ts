import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * AES-256-GCM encrypt a plaintext patch for the wire: iv(12) || authTag(16)
 * || ciphertext, base64-encoded (matches the existing base64-for-opaque-bytes
 * convention at src/main/http-client/ipc/http.ts:124 -- the push body is a
 * JSON array mixing docKey/clientId with patch, not a pure binary blob, so
 * base64-inside-JSON is simpler than a separate binary content-type).
 *
 * `docKey` is bound as GCM AAD -- a mislabeled or corrupted ciphertext fails
 * decryption loudly instead of silently merging into the wrong Yjs doc.
 */
export function encryptPatch(dek: Buffer, docKey: string, plaintext: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  cipher.setAAD(Buffer.from(docKey, 'utf-8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

/** Throws (auth-tag mismatch) on the wrong DEK, tampered ciphertext, or a mismatched `docKey`. */
export function decryptPatch(dek: Buffer, docKey: string, wire: string): Buffer {
  const raw = Buffer.from(wire, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAAD(Buffer.from(docKey, 'utf-8'));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

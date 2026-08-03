import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256
const SALT_LENGTH = 16;

/** Fresh random data-encryption key for a new account. */
export function generateDek(): Buffer {
  return randomBytes(KEY_LENGTH);
}

/**
 * Fresh random salt for a first-ever master-password setup -- the backend
 * actually stores this alongside `wrappedDek` (`PUT /api/account/key
 * { wrappedDek, kdfSalt }`) and returns it back on every `GET`, so unlike an
 * earlier draft of this module, this does NOT need to be derived
 * deterministically from userId; the server round-trips it for us.
 */
export function generateKdfSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

/** Derives a wrapping key from the user's master password and the account's `kdfSalt`. */
export function deriveWrappingKey(password: string, kdfSalt: Buffer): Buffer {
  return scryptSync(password, kdfSalt, KEY_LENGTH);
}

/** AES-256-GCM wrap: iv(12) || authTag(16) || ciphertext. */
export function wrapDek(dek: Buffer, wrappingKey: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', wrappingKey, iv);
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

/** Throws (auth-tag mismatch) if `wrappingKey` was derived from the wrong password. */
export function unwrapDek(wrapped: Buffer, wrappingKey: Buffer): Buffer {
  const iv = wrapped.subarray(0, IV_LENGTH);
  const authTag = wrapped.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = wrapped.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', wrappingKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

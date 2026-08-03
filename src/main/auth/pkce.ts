import { createHash, randomBytes } from 'crypto';

export interface Pkce {
  verifier: string;
  challenge: string;
}

/** RFC 7636 PKCE pair -- `challenge` is the S256 challenge for `verifier`. */
export function generatePkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

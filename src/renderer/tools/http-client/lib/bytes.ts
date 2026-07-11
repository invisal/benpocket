/** Decodes a base64 string into raw bytes. No Buffer global in the renderer, so this goes through atob. */
export function base64ToBytes(base64: string): Uint8Array {
  if (!base64) return new Uint8Array(0);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const utf8Decoder = new TextDecoder('utf-8', { fatal: false });

/** Best-effort UTF-8 decode; invalid sequences become U+FFFD rather than throwing. */
export function bytesToText(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

const BINARY_SNIFF_WINDOW = 512;

/** Heuristic: sniffs the first bytes for NUL bytes or a high ratio of non-printable characters. */
export function looksBinary(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const window = bytes.subarray(0, Math.min(bytes.length, BINARY_SNIFF_WINDOW));
  let nonPrintable = 0;
  for (const byte of window) {
    if (byte === 0) return true;
    const isControl = byte < 0x09 || (byte > 0x0d && byte < 0x20);
    if (isControl) nonPrintable++;
  }
  return nonPrintable / window.length > 0.1;
}

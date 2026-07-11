export interface HexRow {
  offset: string;
  hex: string;
  ascii: string;
}

const BYTES_PER_ROW = 16;
export const HEX_ROW_LIMIT = 4096;

function toAscii(byte: number): string {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
}

/** Classic offset/hex/ascii dump, capped at `limit` rows to keep huge binary bodies from blowing up the DOM. */
export function toHexRows(bytes: Uint8Array, limit = HEX_ROW_LIMIT): HexRow[] {
  const rowCount = Math.min(Math.ceil(bytes.length / BYTES_PER_ROW), limit);
  const rows: HexRow[] = [];

  for (let row = 0; row < rowCount; row++) {
    const start = row * BYTES_PER_ROW;
    const chunk = bytes.subarray(start, start + BYTES_PER_ROW);

    const hexParts: string[] = [];
    let ascii = '';
    for (let i = 0; i < BYTES_PER_ROW; i++) {
      if (i < chunk.length) {
        hexParts.push(chunk[i].toString(16).padStart(2, '0'));
        ascii += toAscii(chunk[i]);
      } else {
        hexParts.push('  ');
      }
      if (i === 7) hexParts.push('');
    }

    rows.push({
      offset: start.toString(16).padStart(8, '0'),
      hex: hexParts.join(' '),
      ascii
    });
  }

  return rows;
}

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const DOWNLOAD_CANCELLED_MESSAGE = 'model download cancelled';

export interface ModelFile {
  filename: string;
  sizeBytes: number;
  sha256: string;
}

async function sha256File(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

/** Verifies `dir/file.filename` already exists with the exact size + sha256 `file` declares --
 * shared by every model cache (upscale's archive-extracted files and bg-remove's plain download)
 * so a corrupt or partial download never gets treated as a cache hit. */
export async function fileMatches(dir: string, file: ModelFile): Promise<boolean> {
  const filePath = path.join(dir, file.filename);
  try {
    const info = await stat(filePath);
    if (info.size !== file.sizeBytes) return false;
    return (await sha256File(filePath)) === file.sha256;
  } catch {
    return false;
  }
}

/**
 * Streams `url` to `destPath`, reporting 0-100 percent progress as bytes arrive. Shared by every
 * model cache -- the only thing that differs between an archive (upscale) and a plain `.onnx`
 * file (bg-remove) is what happens to the file afterward.
 */
export async function downloadWithProgress(
  url: string,
  destPath: string,
  expectedBytes: number,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }

  const total = Number(response.headers.get('content-length')) || expectedBytes;
  let received = 0;

  const fileStream = createWriteStream(destPath);
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      onProgress(total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0);
      if (!fileStream.write(value)) {
        await new Promise<void>((resolve) => fileStream.once('drain', () => resolve()));
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      fileStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}

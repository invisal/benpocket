import { mkdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DOWNLOAD_CANCELLED_MESSAGE, downloadWithProgress, fileMatches } from '../model/download';
import type { BgRemoveModel } from './models';

export const MODEL_DOWNLOAD_CANCELLED_MESSAGE = DOWNLOAD_CANCELLED_MESSAGE;

/** `cacheRoot` is `userData/models/bg-remove` (see `ipc.ts`) -- kept as a plain parameter instead
 * of reaching into `app.getPath` here so this module has no Electron dependency of its own. */
function modelDir(cacheRoot: string): string {
  return cacheRoot;
}

export function modelPath(cacheRoot: string, model: BgRemoveModel): string {
  return path.join(modelDir(cacheRoot), model.filename);
}

export async function isModelCached(cacheRoot: string, model: BgRemoveModel): Promise<boolean> {
  return fileMatches(modelDir(cacheRoot), model);
}

/**
 * Downloads `model`'s `.onnx` graph straight into `userData/models/bg-remove/` (see `models.ts`
 * for provenance) and verifies its sha256 afterward. No-ops if a valid copy is already cached.
 * Unlike upscale's models, there's no archive to unpack -- the release asset already is the
 * graph -- so this downloads to a temp file and renames into place on success, same "verify
 * before it's visible as cached" guarantee without the extraction step.
 */
export async function ensureModel(
  cacheRoot: string,
  model: BgRemoveModel,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (await isModelCached(cacheRoot, model)) return modelPath(cacheRoot, model);

  const dir = modelDir(cacheRoot);
  await mkdir(dir, { recursive: true });

  const tempPath = path.join(tmpdir(), `benpocket-bg-remove-${model.id}-${Date.now()}.onnx`);
  try {
    try {
      await downloadWithProgress(model.url, tempPath, model.sizeBytes, onProgress, signal);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(DOWNLOAD_CANCELLED_MESSAGE);
      }
      throw err;
    }

    if (!(await fileMatches(tmpdir(), { ...model, filename: path.basename(tempPath) }))) {
      throw new Error(`Downloaded model file for "${model.label}" failed checksum verification.`);
    }

    await rename(tempPath, modelPath(cacheRoot, model));
  } finally {
    await rm(tempPath, { force: true });
  }

  return modelPath(cacheRoot, model);
}

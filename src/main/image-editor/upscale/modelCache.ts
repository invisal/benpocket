import { mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import extractZip from 'extract-zip';
import { DOWNLOAD_CANCELLED_MESSAGE, downloadWithProgress, fileMatches } from '../model/download';
import type { UpscaleModel, UpscaleModelFile } from './models';

export const MODEL_DOWNLOAD_CANCELLED_MESSAGE = DOWNLOAD_CANCELLED_MESSAGE;

/** `cacheRoot` is `userData/models` (see `ipc.ts`) -- kept as a plain parameter instead of
 * reaching into `app.getPath` here so this module has no Electron dependency of its own. */
function modelDir(cacheRoot: string, model: UpscaleModel): string {
  return path.join(cacheRoot, model.id);
}

export function graphPath(cacheRoot: string, model: UpscaleModel): string {
  return path.join(modelDir(cacheRoot, model), model.graph.filename);
}

export async function isModelCached(cacheRoot: string, model: UpscaleModel): Promise<boolean> {
  const dir = modelDir(cacheRoot, model);
  return (await fileMatches(dir, model.graph)) && (await fileMatches(dir, model.data));
}

/** The archive nests its files one level down (e.g. `real_esrgan_x4plus-onnx-float/<file>`) --
 * search a couple of levels deep instead of hardcoding that path, so a future archive layout
 * change doesn't silently break extraction. */
async function findExtractedFile(
  root: string,
  filename: string,
  depth = 3
): Promise<string | null> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name === filename) return entryPath;
    if (entry.isDirectory() && depth > 0) {
      const found = await findExtractedFile(entryPath, filename, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Downloads and unpacks `model`'s ONNX graph + external-data weights into
 * `userData/models/<id>/` (see `models.ts` for provenance), verifying both files' sha256
 * afterward. No-ops if a valid copy is already cached. Progress is reported as a 0-100 percent
 * of the archive download (extraction/verification are fast by comparison and not broken out).
 */
export async function ensureModel(
  cacheRoot: string,
  model: UpscaleModel,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (await isModelCached(cacheRoot, model)) return graphPath(cacheRoot, model);

  const dir = modelDir(cacheRoot, model);
  await mkdir(dir, { recursive: true });

  const tempDir = await mkdtemp(path.join(tmpdir(), `benpocket-upscale-${model.id}-`));
  try {
    const zipPath = path.join(tempDir, 'model.zip');
    try {
      await downloadWithProgress(
        model.archiveUrl,
        zipPath,
        model.archiveSizeBytes,
        onProgress,
        signal
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(DOWNLOAD_CANCELLED_MESSAGE);
      }
      throw err;
    }

    const extractDir = path.join(tempDir, 'extracted');
    await extractZip(zipPath, { dir: extractDir });

    for (const file of [model.graph, model.data] as UpscaleModelFile[]) {
      const found = await findExtractedFile(extractDir, file.filename);
      if (!found) {
        throw new Error(`Downloaded archive for "${model.label}" is missing ${file.filename}.`);
      }
      await rename(found, path.join(dir, file.filename));
    }

    if (!(await isModelCached(cacheRoot, model))) {
      throw new Error(`Downloaded model files for "${model.label}" failed checksum verification.`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  return graphPath(cacheRoot, model);
}

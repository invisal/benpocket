import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { type MutationResult } from './fileDriver';
import { parseLocation } from './location';
import { getAvailableName, localFileDriver } from './localFileDriver';
import {
  getAvailableR2Name,
  getS3Client,
  keyBasename,
  listAllKeysUnderPrefix,
  normalizePrefix,
  parseR2Uri,
  r2FileDriver
} from './r2FileDriver';

export interface TransferProgress {
  currentFile: string;
  filesCompleted: number;
  totalFiles: number;
  bytesTransferred: number;
  totalBytes: number;
}

type OnProgress = (progress: TransferProgress) => void;

interface LocalPlanEntry {
  /** Absolute local path to read from, or null for an empty-directory marker. */
  sourcePath: string | null;
  /** R2 key to write to (relative to the bucket root). */
  destKey: string;
  size: number;
}

async function walkLocalDir(rootDir: string, destKeyPrefix: string): Promise<LocalPlanEntry[]> {
  const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  if (entries.length === 0) {
    return [{ sourcePath: null, destKey: destKeyPrefix, size: 0 }];
  }

  const results: LocalPlanEntry[] = [];
  for (const entry of entries) {
    const absPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkLocalDir(absPath, `${destKeyPrefix}${entry.name}/`)));
    } else {
      const stats = await fs.promises.stat(absPath);
      results.push({
        sourcePath: absPath,
        destKey: `${destKeyPrefix}${entry.name}`,
        size: stats.size
      });
    }
  }
  return results;
}

async function uploadEntries(
  sourceUris: string[],
  destDirUri: string,
  onProgress?: OnProgress
): Promise<MutationResult> {
  const client = getS3Client();
  const { bucket, key: destKey } = parseR2Uri(destDirUri);
  const destPrefix = normalizePrefix(destKey);

  try {
    const plan: LocalPlanEntry[] = [];
    for (const sourcePath of sourceUris) {
      const stats = await fs.promises.stat(sourcePath);
      const baseName = path.basename(sourcePath);

      // Resolve the top-level name conflict once per source item (matches
      // how the same-scheme drivers only rename the item being copied in,
      // not its nested contents), then walk the renamed root.
      const availableName = await getAvailableR2Name(
        client,
        bucket,
        destPrefix,
        stats.isDirectory() ? `${baseName}/` : baseName
      );

      if (stats.isDirectory()) {
        plan.push(...(await walkLocalDir(sourcePath, `${destPrefix}${availableName}`)));
      } else {
        plan.push({ sourcePath, destKey: `${destPrefix}${availableName}`, size: stats.size });
      }
    }

    const streamable = plan.filter((entry) => entry.sourcePath !== null);
    const totalFiles = streamable.length;
    const totalBytes = streamable.reduce((sum, entry) => sum + entry.size, 0);
    let filesCompleted = 0;
    let bytesCompletedBefore = 0;

    for (const entry of plan) {
      if (entry.sourcePath === null) {
        // Empty directory -- write the zero-byte marker convention used
        // elsewhere in r2FileDriver (see createFolder) so it still shows up.
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: entry.destKey, Body: '' }));
        continue;
      }

      onProgress?.({
        currentFile: entry.destKey,
        filesCompleted,
        totalFiles,
        bytesTransferred: bytesCompletedBefore,
        totalBytes
      });

      const upload = new Upload({
        client,
        params: { Bucket: bucket, Key: entry.destKey, Body: fs.createReadStream(entry.sourcePath) }
      });

      upload.on('httpUploadProgress', (progress) => {
        onProgress?.({
          currentFile: entry.destKey,
          filesCompleted,
          totalFiles,
          bytesTransferred: bytesCompletedBefore + (progress.loaded ?? 0),
          totalBytes
        });
      });

      await upload.done();

      filesCompleted += 1;
      bytesCompletedBefore += entry.size;
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

interface R2PlanEntry {
  bucket: string;
  /** R2 key to read from, or null for an empty-folder marker with no body. */
  sourceKey: string | null;
  destPath: string;
  size: number;
}

async function listObjectsWithSize(
  client: ReturnType<typeof getS3Client>,
  bucket: string,
  prefix: string
): Promise<{ key: string; size: number }[]> {
  const keys = await listAllKeysUnderPrefix(client, bucket, prefix);
  const results: { key: string; size: number }[] = [];
  for (const key of keys) {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    results.push({ key, size: head.ContentLength ?? 0 });
  }
  return results;
}

async function downloadEntries(
  sourceUris: string[],
  destDirUri: string,
  onProgress?: OnProgress
): Promise<MutationResult> {
  const client = getS3Client();

  try {
    const plan: R2PlanEntry[] = [];
    for (const sourceUri of sourceUris) {
      const { bucket, key } = parseR2Uri(sourceUri);

      if (key.endsWith('/')) {
        const folderName = keyBasename(key);
        const availableName = await getAvailableName(destDirUri, folderName);
        const destRoot = path.join(destDirUri, availableName);
        await fs.promises.mkdir(destRoot, { recursive: true });

        const objects = await listObjectsWithSize(client, bucket, key);
        for (const object of objects) {
          const relative = object.key.slice(key.length);
          if (relative === '') continue; // the folder's own placeholder marker
          const destPath = path.join(destRoot, relative);
          if (relative.endsWith('/')) {
            await fs.promises.mkdir(destPath, { recursive: true });
            plan.push({ bucket, sourceKey: null, destPath, size: 0 });
          } else {
            plan.push({ bucket, sourceKey: object.key, destPath, size: object.size });
          }
        }
      } else {
        const baseName = keyBasename(key);
        const availableName = await getAvailableName(destDirUri, baseName);
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        plan.push({
          bucket,
          sourceKey: key,
          destPath: path.join(destDirUri, availableName),
          size: head.ContentLength ?? 0
        });
      }
    }

    const streamable = plan.filter((entry) => entry.sourceKey !== null);
    const totalFiles = streamable.length;
    const totalBytes = streamable.reduce((sum, entry) => sum + entry.size, 0);
    let filesCompleted = 0;
    let bytesCompletedBefore = 0;

    for (const entry of plan) {
      if (entry.sourceKey === null) continue;

      await fs.promises.mkdir(path.dirname(entry.destPath), { recursive: true });

      onProgress?.({
        currentFile: entry.destPath,
        filesCompleted,
        totalFiles,
        bytesTransferred: bytesCompletedBefore,
        totalBytes
      });

      const response = await client.send(
        new GetObjectCommand({ Bucket: entry.bucket, Key: entry.sourceKey })
      );
      const body = response.Body;
      if (!body) throw new Error(`Empty response body for ${entry.sourceKey}`);

      let bytesRead = 0;
      const readable = body as NodeJS.ReadableStream;
      readable.on('data', (chunk: Buffer) => {
        bytesRead += chunk.length;
        onProgress?.({
          currentFile: entry.destPath,
          filesCompleted,
          totalFiles,
          bytesTransferred: bytesCompletedBefore + bytesRead,
          totalBytes
        });
      });

      await pipeline(readable, fs.createWriteStream(entry.destPath));

      filesCompleted += 1;
      bytesCompletedBefore += entry.size;
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

/**
 * Copies (or moves) entries between a local filesystem location and an R2
 * location -- the direction neither `localFileDriver` nor `r2FileDriver` can
 * handle alone, since each only operates within its own scheme.
 */
export async function transferEntries(
  sourceUris: string[],
  destDirUri: string,
  options: { move: boolean },
  onProgress?: OnProgress
): Promise<MutationResult> {
  const destScheme = parseLocation(destDirUri).scheme;

  const result =
    destScheme === 'r2'
      ? await uploadEntries(sourceUris, destDirUri, onProgress)
      : await downloadEntries(sourceUris, destDirUri, onProgress);

  if ('error' in result) return result;
  if (!options.move) return result;

  // Move = transfer then delete the originals, mirroring how R2's own
  // moveEntries does copy-then-delete (there's no atomic cross-system rename).
  return destScheme === 'r2'
    ? localFileDriver.deleteEntries(sourceUris)
    : r2FileDriver.deleteEntries(sourceUris);
}

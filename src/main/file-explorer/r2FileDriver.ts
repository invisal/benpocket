import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import Cloudflare from 'cloudflare';
import {
  MAX_PREVIEW_FILE_BYTES,
  PREVIEWABLE_EXTENSIONS,
  type CreateResult,
  type DriverCapabilities,
  type FileDriver,
  type FileEntry,
  type ListDirectoryResult,
  type MutationResult,
  type ReadFileResult,
  type WriteFileResult
} from './fileDriver';
import { getR2Credential } from './r2Credential';
import { parseLocation } from './location';

function getS3Client(): S3Client {
  const credential = getR2Credential();
  if (!credential) throw new Error('R2 is not configured.');

  // Construction is cheap (no connection opened until a command is sent), so a
  // fresh client per call sidesteps invalidating a cached one on credential rotation.
  return new S3Client({
    region: 'auto',
    endpoint: `https://${credential.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: credential.accessKeyId,
      secretAccessKey: credential.secretAccessKey
    }
  });
}

function getCloudflareClient(): Cloudflare {
  const credential = getR2Credential();
  if (!credential) throw new Error('R2 is not configured.');
  return new Cloudflare({ apiToken: credential.apiToken });
}

function parseR2Uri(uri: string): { bucket: string; key: string } {
  const { path } = parseLocation(uri);
  const slashIndex = path.indexOf('/');
  if (slashIndex === -1) return { bucket: path, key: '' };
  return { bucket: path.slice(0, slashIndex), key: path.slice(slashIndex + 1) };
}

function normalizePrefix(key: string): string {
  if (key === '') return '';
  return key.endsWith('/') ? key : `${key}/`;
}

function keyBasename(key: string): string {
  const trimmed = key.replace(/\/$/, '');
  const slashIndex = trimmed.lastIndexOf('/');
  return slashIndex === -1 ? trimmed : trimmed.slice(slashIndex + 1);
}

function keyExtension(key: string): string {
  const name = keyBasename(key);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex <= 0 ? '' : name.slice(dotIndex + 1).toLowerCase();
}

async function objectExists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function listAllKeysUnderPrefix(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken
      })
    );
    for (const obj of response.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function batchDeleteKeys(client: S3Client, bucket: string, keys: string[]): Promise<void> {
  // DeleteObjectsCommand caps out at 1000 keys per request.
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })) }
      })
    );
  }
}

async function copyObject(
  client: S3Client,
  bucket: string,
  sourceKey: string,
  destKey: string
): Promise<void> {
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: encodeURIComponent(`${bucket}/${sourceKey}`),
      Key: destKey
    })
  );
}

async function listDirectory(uri: string, cursor?: string): Promise<ListDirectoryResult> {
  const { bucket, key } = parseR2Uri(uri);
  if (!bucket) return { error: 'No bucket selected.' };
  const prefix = normalizePrefix(key);

  try {
    const client = getS3Client();
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: '/',
        ContinuationToken: cursor
      })
    );

    const folders: FileEntry[] = (response.CommonPrefixes ?? []).flatMap((commonPrefix) => {
      const name = commonPrefix.Prefix ? keyBasename(commonPrefix.Prefix) : '';
      if (!name || !commonPrefix.Prefix) return [];
      return [
        {
          name,
          path: `r2://${bucket}/${commonPrefix.Prefix}`,
          isDirectory: true,
          size: 0,
          modifiedMs: 0,
          extension: ''
        }
      ];
    });

    const files: FileEntry[] = (response.Contents ?? []).flatMap((object) => {
      // Skip the zero-byte "folder placeholder" object at the prefix itself.
      if (!object.Key || object.Key === prefix) return [];
      return [
        {
          name: keyBasename(object.Key),
          path: `r2://${bucket}/${object.Key}`,
          isDirectory: false,
          size: object.Size ?? 0,
          modifiedMs: object.LastModified ? object.LastModified.getTime() : 0,
          extension: keyExtension(object.Key)
        }
      ];
    });

    return {
      entries: [...folders, ...files],
      nextCursor: response.IsTruncated ? (response.NextContinuationToken ?? null) : null
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

async function readFile(uri: string): Promise<ReadFileResult> {
  const { bucket, key } = parseR2Uri(uri);
  const extension = keyExtension(key);
  if (!PREVIEWABLE_EXTENSIONS.has(extension)) {
    return { error: 'unsupported-extension' };
  }

  try {
    const client = getS3Client();
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if ((response.ContentLength ?? 0) > MAX_PREVIEW_FILE_BYTES) {
      return { error: 'too-large', maxBytes: MAX_PREVIEW_FILE_BYTES };
    }
    const content = (await response.Body?.transformToString('utf-8')) ?? '';
    return { content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

async function writeFile(uri: string, content: string): Promise<WriteFileResult> {
  const { bucket, key } = parseR2Uri(uri);
  const extension = keyExtension(key);
  if (!PREVIEWABLE_EXTENSIONS.has(extension)) {
    return { error: 'unsupported-extension' };
  }

  try {
    const client = getS3Client();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: content }));
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

async function deleteEntries(uris: string[]): Promise<MutationResult> {
  if (uris.length === 0) return { success: true };
  const { bucket } = parseR2Uri(uris[0]);

  try {
    const client = getS3Client();
    const keysToDelete: string[] = [];
    for (const uri of uris) {
      const { key } = parseR2Uri(uri);
      if (key.endsWith('/')) {
        keysToDelete.push(...(await listAllKeysUnderPrefix(client, bucket, key)));
      } else {
        keysToDelete.push(key);
      }
    }
    await batchDeleteKeys(client, bucket, keysToDelete);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

async function copyEntries(sourceUris: string[], destDirUri: string): Promise<MutationResult> {
  const { bucket, key: destKey } = parseR2Uri(destDirUri);
  const destPrefix = normalizePrefix(destKey);

  try {
    const client = getS3Client();
    for (const sourceUri of sourceUris) {
      const source = parseR2Uri(sourceUri);
      if (source.bucket !== bucket) {
        throw new Error('Copying across buckets is not supported.');
      }

      if (source.key.endsWith('/')) {
        const keys = await listAllKeysUnderPrefix(client, bucket, source.key);
        const folderName = keyBasename(source.key);
        for (const objectKey of keys) {
          const relative = objectKey.slice(source.key.length);
          await copyObject(client, bucket, objectKey, `${destPrefix}${folderName}/${relative}`);
        }
      } else {
        await copyObject(client, bucket, source.key, `${destPrefix}${keyBasename(source.key)}`);
      }
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

async function moveEntries(sourceUris: string[], destDirUri: string): Promise<MutationResult> {
  // R2 has no atomic rename -- copy then delete the originals.
  const copyResult = await copyEntries(sourceUris, destDirUri);
  if ('error' in copyResult) return copyResult;
  return deleteEntries(sourceUris);
}

async function createFile(destDirUri: string, name: string): Promise<CreateResult> {
  const { bucket, key: destKey } = parseR2Uri(destDirUri);
  const key = `${normalizePrefix(destKey)}${name}`;

  try {
    const client = getS3Client();
    if (await objectExists(client, bucket, key)) return { error: 'exists' };
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: '' }));
    return { success: true, path: `r2://${bucket}/${key}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

async function createFolder(destDirUri: string, name: string): Promise<CreateResult> {
  const { bucket, key: destKey } = parseR2Uri(destDirUri);
  // Real folders don't exist in S3 -- a zero-byte object whose key ends in
  // '/' is the conventional placeholder that makes an empty "folder" show up.
  const key = `${normalizePrefix(destKey)}${name}/`;

  try {
    const client = getS3Client();
    if (await objectExists(client, bucket, key)) return { error: 'exists' };
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: '' }));
    return { success: true, path: `r2://${bucket}/${key}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

const capabilities: DriverCapabilities = {
  trash: false,
  nativeIcons: false,
  atomicMove: false,
  realFolders: false,
  sync: 'optimistic'
};

export const r2FileDriver: FileDriver = {
  id: 'r2',
  capabilities,
  listDirectory,
  readFile,
  writeFile,
  deleteEntries,
  copyEntries,
  moveEntries,
  createFile,
  createFolder
};

/** Bucket-level listing is a Cloudflare REST API call, not part of the S3-compatible object surface. */
export async function listR2Buckets(): Promise<{ name: string }[] | { error: string }> {
  const credential = getR2Credential();
  if (!credential) return { error: 'R2 is not configured.' };

  try {
    const client = getCloudflareClient();
    const response = await client.r2.buckets.list({ account_id: credential.accountId });
    return (response.buckets ?? []).flatMap((bucket) =>
      bucket.name ? [{ name: bucket.name }] : []
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

import { describe, expect, it, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createMockSyncProvider } from './mockSyncProvider';
import type { MockRemoteProfileDescriptor } from './types';

function descriptor(mockServerDbFile: string): MockRemoteProfileDescriptor {
  return {
    id: randomUUID(),
    name: 'Mock',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dbFile: 'x.db',
    kind: 'mock-remote',
    mockServerDbFile
  };
}

describe('push', () => {
  it('assigns increasing seq numbers and echoes localId back', async () => {
    const provider = createMockSyncProvider(descriptor(':memory:'));
    const acks = await provider.push([
      { localId: 1, docKey: 'doc-a', patch: Buffer.from('one'), createdAt: Date.now() },
      { localId: 2, docKey: 'doc-b', patch: Buffer.from('two'), createdAt: Date.now() }
    ]);
    expect(acks).toEqual([
      { localId: 1, remoteSeq: 1 },
      { localId: 2, remoteSeq: 2 }
    ]);
  });
});

describe('pull', () => {
  it('returns only patches after sinceSeq, in order, unencrypted', async () => {
    const provider = createMockSyncProvider(descriptor(':memory:'));
    await provider.push([
      { localId: 1, docKey: 'doc-a', patch: Buffer.from('one'), createdAt: Date.now() },
      { localId: 2, docKey: 'doc-b', patch: Buffer.from('two'), createdAt: Date.now() }
    ]);

    const pulled = await provider.pull(1);
    expect(pulled).toEqual([{ docKey: 'doc-b', remoteSeq: 2, patch: Buffer.from('two') }]);
  });

  it('returns everything on a fresh pull(0)', async () => {
    const provider = createMockSyncProvider(descriptor(':memory:'));
    await provider.push([
      { localId: 1, docKey: 'doc', patch: Buffer.from('one'), createdAt: Date.now() }
    ]);

    expect(await provider.pull(0)).toHaveLength(1);
  });
});

describe('two devices sharing one mockServerDbFile', () => {
  const sharedPath = join(tmpdir(), `mock-server-${randomUUID()}.db`);

  afterEach(() => {
    if (existsSync(sharedPath)) unlinkSync(sharedPath);
  });

  it("sees each other's pushes", async () => {
    const deviceA = createMockSyncProvider(descriptor(sharedPath));
    const deviceB = createMockSyncProvider(descriptor(sharedPath));

    await deviceA.push([
      { localId: 1, docKey: 'doc', patch: Buffer.from('from-a'), createdAt: Date.now() }
    ]);
    const pulled = await deviceB.pull(0);

    expect(pulled).toEqual([{ docKey: 'doc', remoteSeq: 1, patch: Buffer.from('from-a') }]);

    // Release the file handles -- afterEach's unlinkSync would otherwise fail
    // on Windows while either connection is still open.
    deviceA.close();
    deviceB.close();
  });
});

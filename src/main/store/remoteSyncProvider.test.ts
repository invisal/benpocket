import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'crypto';
import { createRemoteSyncProvider } from './remoteSyncProvider';
import { RemoteAuthError } from './remoteAuthClient';
import { decryptPatch, encryptPatch } from './remoteCrypto';
import type { OfflineStore, ProfileConfig, RemoteProfileDescriptor, SyncProvider } from './types';

const now = Date.now();

const descriptor: RemoteProfileDescriptor = {
  id: randomUUID(),
  name: 'Remote',
  createdAt: now,
  updatedAt: now,
  dbFile: 'x.db',
  kind: 'remote',
  apiBaseUrl: 'https://api.example.com',
  provider: 'github'
};

type FakeOfflineStore = OfflineStore & { settings: Map<string, string> };

function createFakeOfflineStore(): FakeOfflineStore {
  const settings = new Map<string, string>();
  return {
    profileId: randomUUID(),
    settings,
    open: async () => {},
    close: () => {},
    appendPatch: async () => {},
    loadSnapshot: async () => null,
    getSetting: (key) => settings.get(key),
    setSetting: (key, value) => {
      settings.set(key, value);
    },
    listUnpushedPatches: () => [],
    markPushed: () => {},
    getSyncCursor: () => 0,
    applyRemotePatches: () => {},
    listCompactionCandidates: () => [],
    applyCompact: () => {}
  };
}

function remoteConfig(overrides: Partial<Extract<ProfileConfig, { kind: 'remote' }>> = {}) {
  return {
    kind: 'remote' as const,
    apiBaseUrl: descriptor.apiBaseUrl,
    provider: 'github' as const,
    refreshToken: 'refresh-1',
    token: 'access-1',
    dek: randomBytes(32),
    ...overrides
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function setup(): { store: FakeOfflineStore; provider: SyncProvider; dek: Buffer } {
  const store = createFakeOfflineStore();
  const config = remoteConfig();
  const provider = createRemoteSyncProvider(descriptor, store, config);
  return { store, provider, dek: config.dek };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createRemoteSyncProvider construction', () => {
  it('persists accessToken/refreshToken/dek when initialConfig is present', () => {
    const store = createFakeOfflineStore();
    const config = remoteConfig({ token: 'a1', refreshToken: 'r1' });
    createRemoteSyncProvider(descriptor, store, config);

    expect(store.settings.get('remoteSync.accessToken')).toBe('a1');
    expect(store.settings.get('remoteSync.refreshToken')).toBe('r1');
    expect(store.settings.get('remoteSync.dek')).toBe(config.dek.toString('base64'));
  });

  it('reads settings back and never writes when initialConfig is absent', () => {
    const store = createFakeOfflineStore();
    store.settings.set('remoteSync.accessToken', 'a1');
    store.settings.set('remoteSync.refreshToken', 'r1');
    store.settings.set('remoteSync.dek', randomBytes(32).toString('base64'));
    const setSettingSpy = vi.spyOn(store, 'setSetting');

    expect(() => createRemoteSyncProvider(descriptor, store)).not.toThrow();
    expect(setSettingSpy).not.toHaveBeenCalled();
  });

  it('throws immediately when a setting is missing on a non-initial open', () => {
    const store = createFakeOfflineStore();
    expect(() => createRemoteSyncProvider(descriptor, store)).toThrow(/missing persisted setting/);
  });

  it('reloads the same DEK after restart, even when initialConfig.dek arrives as a plain Uint8Array (as it does over IPC, since structured-clone drops the Buffer subclass)', async () => {
    const store = createFakeOfflineStore();
    const originalDek = randomBytes(32);
    // Simulate what actually crosses contextBridge/ipcRenderer.invoke: a plain
    // Uint8Array with the same bytes, not a Node Buffer instance.
    const dekOverIpc = new Uint8Array(originalDek);
    expect(Buffer.isBuffer(dekOverIpc)).toBe(false);

    const firstProvider = createRemoteSyncProvider(
      descriptor,
      store,
      remoteConfig({ dek: dekOverIpc as unknown as Buffer })
    );

    const encrypted = encryptPatch(originalDek, 'doc-1', Buffer.from('hello'));
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, [{ docKey: 'doc-1', seq: 1, patch: encrypted }])
    );
    vi.stubGlobal('fetch', fetchMock);
    await firstProvider.pull(0);

    // "Close and reopen": a fresh provider instance backed by the same store,
    // with no initialConfig -- must read the DEK back from settings.
    const reloadedProvider = createRemoteSyncProvider(descriptor, store);
    const patches = await reloadedProvider.pull(0);
    expect(patches).toEqual([{ docKey: 'doc-1', remoteSeq: 1, patch: Buffer.from('hello') }]);
  });
});

describe('push', () => {
  it('resolves to [] without calling fetch for an empty batch', async () => {
    const { provider } = setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await provider.push([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends encrypted patches and maps clientId/seq back to PushAck', async () => {
    const { provider, dek } = setup();

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(`${descriptor.apiBaseUrl}/api/kv/patches`);
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-1');

      const sent = JSON.parse(init?.body as string) as {
        clientId: number;
        docKey: string;
        patch: string;
      }[];
      expect(sent).toHaveLength(1);
      expect(sent[0].clientId).toBe(1);
      expect(sent[0].docKey).toBe('doc-1');
      expect(decryptPatch(dek, 'doc-1', sent[0].patch)).toEqual(Buffer.from('hello'));

      return jsonResponse(200, [{ clientId: 1, seq: 42 }]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const acks = await provider.push([
      { localId: 1, docKey: 'doc-1', patch: Buffer.from('hello'), createdAt: now }
    ]);
    expect(acks).toEqual([{ localId: 1, remoteSeq: 42 }]);
  });
});

describe('pull', () => {
  it('sends the since query param and decrypts returned patches', async () => {
    const { provider, dek } = setup();
    const encrypted = encryptPatch(dek, 'doc-1', Buffer.from('world'));

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(`${descriptor.apiBaseUrl}/api/kv/patches?since=5`);
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-1');
      return jsonResponse(200, [{ docKey: 'doc-1', seq: 6, patch: encrypted }]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const patches = await provider.pull(5);
    expect(patches).toEqual([{ docKey: 'doc-1', remoteSeq: 6, patch: Buffer.from('world') }]);
  });

  it('carries isBaseline through onto the returned RemotePatch', async () => {
    const { provider, dek } = setup();
    const encrypted = encryptPatch(dek, 'doc-1', Buffer.from('merged'));

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, [{ docKey: 'doc-1', seq: 12, patch: encrypted, isBaseline: true }])
      )
    );

    const patches = await provider.pull(0);
    expect(patches).toEqual([
      { docKey: 'doc-1', remoteSeq: 12, patch: Buffer.from('merged'), isBaseline: true }
    ]);
  });
});

describe('compact', () => {
  it('sends the encrypted baseline and passes through {ok, noop}', async () => {
    const { provider, dek } = setup();

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(`${descriptor.apiBaseUrl}/api/kv/doc-1/compact`);
      expect(init?.method).toBe('POST');
      const sent = JSON.parse(init?.body as string) as { upToSeq: number; baseline: string };
      expect(sent.upToSeq).toBe(12);
      expect(decryptPatch(dek, 'doc-1', sent.baseline)).toEqual(Buffer.from('merged'));
      return jsonResponse(200, { ok: true, noop: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.compact!('doc-1', 12, Buffer.from('merged'));
    expect(result).toEqual({ ok: true, noop: true });
  });

  it('URL-encodes a docKey that needs it', async () => {
    const { provider } = setup();
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(`${descriptor.apiBaseUrl}/api/kv/doc%2Fwith%20slash/compact`);
      return jsonResponse(200, { ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    await provider.compact!('doc/with slash', 1, Buffer.from('x'));
  });

  it('throws with the response body on a non-ok status', async () => {
    const { provider } = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 400 }))
    );

    await expect(provider.compact!('doc-1', 1, Buffer.from('x'))).rejects.toThrow(
      /Compact failed: 400/
    );
  });
});

describe('401 refresh-and-retry', () => {
  it('refreshes once, persists new tokens, and retries the original request', async () => {
    const { store, provider } = setup();
    let call = 0;

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      call++;
      if (call === 1) {
        expect(url).toBe(`${descriptor.apiBaseUrl}/api/kv/patches?since=0`);
        return new Response(null, { status: 401 });
      }
      if (call === 2) {
        expect(url).toBe(`${descriptor.apiBaseUrl}/auth/refresh`);
        expect(JSON.parse(init?.body as string)).toEqual({ refreshToken: 'refresh-1' });
        return jsonResponse(200, { accessToken: 'access-2', refreshToken: 'refresh-2' });
      }
      expect(call).toBe(3);
      expect(url).toBe(`${descriptor.apiBaseUrl}/api/kv/patches?since=0`);
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-2');
      return jsonResponse(200, []);
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await provider.pull(0)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(store.settings.get('remoteSync.accessToken')).toBe('access-2');
    expect(store.settings.get('remoteSync.refreshToken')).toBe('refresh-2');
  });

  it('rejects with RemoteAuthError when /auth/refresh itself fails, without retrying', async () => {
    const { provider } = setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return new Response(null, { status: 401 });
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(provider.pull(0)).rejects.toBeInstanceOf(RemoteAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(2); // original + failed refresh, no retry
  });

  it('rejects with RemoteAuthError if the retried request is also 401, without a second refresh', async () => {
    const { provider } = setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, { accessToken: 'access-2', refreshToken: 'refresh-2' });
      }
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(provider.pull(0)).rejects.toBeInstanceOf(RemoteAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(3); // original(401) + refresh + retry(401), no second refresh
  });

  it('dedupes concurrent 401s onto a single /auth/refresh call', async () => {
    const { store, provider } = setup();
    let refreshCalls = 0;

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        // A real single-use-refresh-token backend would reject a second
        // concurrent call using the same (not-yet-rotated) refresh token --
        // asserting call count 1 below is what actually catches a regression.
        expect(JSON.parse(init?.body as string)).toEqual({ refreshToken: 'refresh-1' });
        return jsonResponse(200, { accessToken: 'access-2', refreshToken: 'refresh-2' });
      }
      if (new Headers(init?.headers).get('Authorization') === 'Bearer access-1') {
        return new Response(null, { status: 401 });
      }
      return jsonResponse(
        200,
        url.includes('/api/kv/status') ? { hasChanges: false, latestSeq: 0, count: 0 } : []
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    // Simulates a status precheck racing a pull, both firing on the shared
    // authFetch closure while the access token is still expired.
    await Promise.all([provider.pull(0), provider.status(0)]);

    expect(refreshCalls).toBe(1);
    expect(store.settings.get('remoteSync.accessToken')).toBe('access-2');
    expect(store.settings.get('remoteSync.refreshToken')).toBe('refresh-2');
  });
});

describe('status', () => {
  it('sends the since query param and maps hasChanges/latestSeq/count', async () => {
    const { provider } = setup();

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(`${descriptor.apiBaseUrl}/api/kv/status?since=5`);
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-1');
      return jsonResponse(200, { hasChanges: true, latestSeq: 9, count: 4 });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await provider.status(5)).toEqual({ hasChanges: true, latestSeq: 9, count: 4 });
  });

  it('throws with the response body on a non-ok status', async () => {
    const { provider } = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 }))
    );

    await expect(provider.status(0)).rejects.toThrow(/Status check failed: 500/);
  });
});

describe('close', () => {
  it('does not throw', () => {
    const { provider } = setup();
    expect(() => provider.close()).not.toThrow();
  });
});

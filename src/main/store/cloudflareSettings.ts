import * as Y from 'yjs';
import { getProfileManager } from './ipc';

// Shared with the renderer's usePersistStore('cloudflare/settings', ...) --
// same doc key, same map shape. accountId/apiToken connect the Cloudflare
// account; accessKeyId/secretAccessKey are only needed for R2's S3-compatible
// API, and gatewayId/model for the AI Gateway -- both optional add-ons on top
// of the one Cloudflare connection, not separate accounts.
export const CLOUDFLARE_SETTINGS_KEY = 'cloudflare/settings';

export interface CloudflareSettings {
  accountId: string;
  apiToken: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  selectedBuckets: string[];
  gatewayId?: string;
  model?: string;
}

/**
 * Reads the current Cloudflare settings for main-process consumers
 * (r2FileDriver.ts, agent/client.ts) that need the plaintext credential for
 * outbound API calls and can't use the renderer-only usePersistStore hook.
 * Not cached -- loadSnapshot is a cheap local SQLite read plus a Yjs merge,
 * and skipping a cache sidesteps invalidation across profile switches/syncs.
 */
export async function getCloudflareSettings(): Promise<CloudflareSettings | null> {
  const snapshot = await getProfileManager().loadSnapshot(CLOUDFLARE_SETTINGS_KEY);
  if (!snapshot) return null;

  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  const map = doc.getMap<unknown>(CLOUDFLARE_SETTINGS_KEY);

  const accountId = map.get('accountId');
  const apiToken = map.get('apiToken');
  if (typeof accountId !== 'string' || !accountId || typeof apiToken !== 'string' || !apiToken) {
    return null;
  }

  const accessKeyId = map.get('accessKeyId');
  const secretAccessKey = map.get('secretAccessKey');
  const selectedBuckets = map.get('selectedBuckets');
  const gatewayId = map.get('gatewayId');
  const model = map.get('model');

  return {
    accountId,
    apiToken,
    accessKeyId: typeof accessKeyId === 'string' ? accessKeyId : undefined,
    secretAccessKey: typeof secretAccessKey === 'string' ? secretAccessKey : undefined,
    selectedBuckets: Array.isArray(selectedBuckets) ? (selectedBuckets as string[]) : [],
    gatewayId: typeof gatewayId === 'string' ? gatewayId : undefined,
    model: typeof model === 'string' ? model : undefined
  };
}

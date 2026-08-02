import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { usePersistStore } from './usePersistStore';

// Shared with the main process's getCloudflareSettings() (src/main/store/cloudflareSettings.ts)
// -- same doc key, same map shape. accountId/apiToken connect the Cloudflare
// account; accessKeyId/secretAccessKey are only needed for R2's S3-compatible
// API, and gatewayId/model for the AI Gateway -- both optional add-ons on top
// of the one Cloudflare connection, not separate accounts.
export const CLOUDFLARE_SETTINGS_KEY = 'cloudflare/settings';

export interface CloudflareSettingsFields {
  accountId: string;
  apiToken: string;
  accessKeyId: string;
  secretAccessKey: string;
  selectedBuckets: string[];
  gatewayId: string;
  model: string;
}

function readFields(map: Y.Map<unknown>): CloudflareSettingsFields {
  return {
    accountId: (map.get('accountId') as string | undefined) ?? '',
    apiToken: (map.get('apiToken') as string | undefined) ?? '',
    accessKeyId: (map.get('accessKeyId') as string | undefined) ?? '',
    secretAccessKey: (map.get('secretAccessKey') as string | undefined) ?? '',
    selectedBuckets: (map.get('selectedBuckets') as string[] | undefined) ?? [],
    gatewayId: (map.get('gatewayId') as string | undefined) ?? '',
    model: (map.get('model') as string | undefined) ?? ''
  };
}

export interface UseCloudflareSettingsResult {
  isLoading: boolean;
  fields: CloudflareSettingsFields;
  /** accountId + apiToken are both set -- the Cloudflare account is connected. */
  configured: boolean;
  hasAccessKeys: boolean;
  gatewayConfigured: boolean;
  setFields: (patch: Partial<CloudflareSettingsFields>) => void;
  /** Disconnect -- clears the account connection and everything that depends on it (R2 keys, bucket selection). Leaves gatewayId/model alone, same as before. */
  clearCloudflare: () => void;
  clearGateway: () => void;
}

/**
 * Live view over the shared `cloudflare/settings` doc -- backs every
 * Cloudflare/R2/AI-Gateway settings UI (ConnectCloudflareDialog,
 * SelectR2BucketsDialog, ConnectAiGatewayDialog, AgentPanel, the Home
 * banner) so they all read/write the same fields instead of duplicating
 * usePersistStore + Y.Map boilerplate.
 */
export function useCloudflareSettings(): UseCloudflareSettingsResult {
  const { isLoading, doc } = usePersistStore(CLOUDFLARE_SETTINGS_KEY, () => new Y.Doc());
  const map = doc.getMap<unknown>(CLOUDFLARE_SETTINGS_KEY);
  const [fields, setFieldsState] = useState<CloudflareSettingsFields>(() => readFields(map));

  useEffect(() => {
    const sync = (): void => setFieldsState(readFields(map));
    sync();
    map.observe(sync);
    return () => map.unobserve(sync);
  }, [map]);

  const setFields = (patch: Partial<CloudflareSettingsFields>): void => {
    doc.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        map.set(key, value);
      }
    });
  };

  const clearCloudflare = (): void => {
    doc.transact(() => {
      map.delete('accountId');
      map.delete('apiToken');
      map.delete('accessKeyId');
      map.delete('secretAccessKey');
      map.delete('selectedBuckets');
    });
  };

  const clearGateway = (): void => {
    doc.transact(() => {
      map.delete('gatewayId');
      map.delete('model');
    });
  };

  return {
    isLoading,
    fields,
    configured: Boolean(fields.accountId && fields.apiToken),
    hasAccessKeys: Boolean(fields.accessKeyId && fields.secretAccessKey),
    gatewayConfigured: Boolean(fields.gatewayId),
    setFields,
    clearCloudflare,
    clearGateway
  };
}

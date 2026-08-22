import { Age } from '../../Age';
import type React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  type MutatingWebhookConfigurationData,
  type WebhookItem
} from '../../../types/MutatingWebhookConfigurationData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useOpenNamespaceDetail, useOpenServiceDetail } from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { buildMutatingWebhookDetailPayload } from '../../../hooks/open-detail/transformers/config.transformer';

interface MutatingWebhookDetailProps {
  payload: MutatingWebhookConfigurationData;
  isTab?: boolean;
}

export const MutatingWebhookDetail: React.FC<MutatingWebhookDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openServiceDetail } = useOpenServiceDetail();

  // Fetch fresh MutatingWebhookConfiguration with React Query caching
  const { data: queryData } = useQuery({
    queryKey: ['kuberneter', 'mutatingwebhook-detail-data', rawConfigPath, cluster, payload?.name],
    queryFn: async () => {
      if (!cluster || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const res = await window.kuberneter.getResources(
        configPathArg,
        cluster,
        K8S_RESOURCE_KEYS.MUTATING_WEBHOOK_CONFIGURATIONS
      );
      const item = ((res?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      return item || null;
    },
    enabled: !!cluster && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return (
      <div className="p-4 text-xs text-zinc-500">
        No MutatingWebhook Configuration details available.
      </div>
    );
  }

  const rawItem = queryData || payload.rawItem;
  const currentData: MutatingWebhookConfigurationData = rawItem
    ? buildMutatingWebhookDetailPayload(payload.name, rawItem)
    : payload;

  const labels = currentData.labels ? Object.entries(currentData.labels) : [];
  const annotations = currentData.annotations ? Object.entries(currentData.annotations) : [];
  const webhooks: WebhookItem[] = currentData.webhooks || [];

  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : currentData.createdTime || '';

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={
              rawItem?.metadata?.creationTimestamp ||
              ((payload as unknown as Record<string, unknown>).creationTimestamp as string)
            }
          />{' '}
          ago ({createdTime || 'N/A'})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: currentData.name
    },
    {
      id: 'webhooksCount',
      name: 'Webhooks Count',
      value: <span className="font-mono">{webhooks.length}</span>
    },
    {
      id: 'apiVersion',
      name: 'API Version',
      value: <span className="font-mono text-zinc-300">{currentData.apiVersion}</span>
    },
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Labels`,
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Webhooks List */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
          Webhooks ({webhooks.length})
        </span>
        {webhooks.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No webhooks defined.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {webhooks.map((w, idx) => (
              <div
                key={w.name + idx}
                className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-zinc-555 uppercase">Name</span>
                  <span className="font-mono text-foreground font-bold break-all select-text">
                    {w.name}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-zinc-555 uppercase">Client Config</span>
                  <div className="font-mono text-zinc-300 mt-0.5 bg-black/10 p-2 rounded border border-border-dark/40">
                    {w.clientConfig.url ? (
                      <div>URL: {w.clientConfig.url}</div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <div>
                          Service:{' '}
                          {w.clientConfig.name && w.clientConfig.namespace ? (
                            <span
                              onClick={() =>
                                openServiceDetail(w.clientConfig.namespace!, w.clientConfig.name!)
                              }
                              className="text-accent hover:underline cursor-pointer"
                              title={`Open Service ${w.clientConfig.name} in new tab`}
                            >
                              {w.clientConfig.name}
                            </span>
                          ) : (
                            w.clientConfig.name || '—'
                          )}
                        </div>
                        <div>
                          Namespace:{' '}
                          {w.clientConfig.namespace ? (
                            <span
                              onClick={() => openNamespaceDetail(w.clientConfig.namespace!)}
                              className="text-accent hover:underline cursor-pointer"
                              title={`Open Namespace ${w.clientConfig.namespace} in new tab`}
                            >
                              {w.clientConfig.namespace}
                            </span>
                          ) : (
                            '—'
                          )}
                        </div>
                        {w.clientConfig.path && <div>Path: {w.clientConfig.path}</div>}
                        {w.clientConfig.port && <div>Port: {w.clientConfig.port}</div>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/20 pt-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Match Policy</span>
                    <span className="font-mono text-zinc-300">{w.matchPolicy}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Failure Policy</span>
                    <span className="font-mono text-zinc-300">{w.failurePolicy}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Admission Review</span>
                    <span className="font-mono text-zinc-300">
                      {w.admissionReviewVersions.join(', ') || '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Reinvocation Policy</span>
                    <span className="font-mono text-zinc-300">{w.reinvocationPolicy}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Side Effects</span>
                    <span className="font-mono text-zinc-300">{w.sideEffects}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-555 uppercase">Timeout Seconds</span>
                    <span className="font-mono text-zinc-300">{w.timeoutSeconds}s</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
                  <span className="text-[10px] text-zinc-555 uppercase">Namespace Selector</span>
                  <span className="font-mono text-zinc-300 select-text break-all">
                    {w.namespaceSelector}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-zinc-555 uppercase">Object Selector</span>
                  <span className="font-mono text-zinc-300 select-text break-all">
                    {w.objectSelector}
                  </span>
                </div>

                {w.rules.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-border/20 pt-2">
                    <span className="text-[10px] text-zinc-555 uppercase">
                      Rules ({w.rules.length})
                    </span>
                    <div className="flex flex-col gap-2 mt-1">
                      {w.rules.map((rule, ruleIdx) => (
                        <div
                          key={ruleIdx}
                          className="text-[11px] font-mono bg-surface-3 p-2 rounded border border-border text-zinc-350"
                        >
                          <div>
                            <span className="text-zinc-555">API Groups:</span>{' '}
                            {rule.apiGroups.join(', ') || '*'}
                          </div>
                          <div>
                            <span className="text-zinc-555">API Versions:</span>{' '}
                            {rule.apiVersions.join(', ') || '*'}
                          </div>
                          <div>
                            <span className="text-zinc-555">Operations:</span>{' '}
                            {rule.operations.join(', ')}
                          </div>
                          <div>
                            <span className="text-zinc-555">Resources:</span>{' '}
                            {rule.resources.join(', ')}
                          </div>
                          <div>
                            <span className="text-zinc-555">Scope:</span> {rule.scope}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};

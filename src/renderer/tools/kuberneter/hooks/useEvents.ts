import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { type EventData } from '../types/EventData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface RawEvent {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
  type?: string;
  source?: {
    component?: string;
    host?: string;
  };
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
    fieldPath?: string;
  };
  message?: string;
  count?: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  reason?: string;
}

export function useEvents(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item, i) => {
        const raw = item as unknown as RawEvent;
        const name = raw.metadata?.name || `event-${i}`;
        const ns = raw.metadata?.namespace || '';
        const lastTs = raw.lastTimestamp || raw.metadata?.creationTimestamp || '';
        const firstTs = raw.firstTimestamp || raw.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          type: raw.type || 'Normal',
          source: raw.source?.component || '-',
          ns,
          involvedObject: raw.involvedObject?.name || '-',
          involvedKind: raw.involvedObject?.kind || '-',
          message: raw.message || '',
          count: raw.count ?? 1,
          age: formatAge(raw.metadata?.creationTimestamp || ''),
          lastSeen: formatAge(lastTs),
          rawLastSeen: new Date(lastTs || Date.now()).getTime(),
          reason: raw.reason || '-',
          firstSeen: formatAge(firstTs),
          involvedNamespace: raw.involvedObject?.namespace || '',
          involvedFieldPath: raw.involvedObject?.fieldPath || '—',
          rawItem: item,
          creationTimestamp: raw.metadata?.creationTimestamp || '',
          firstTimestamp: firstTs || '',
          lastTimestamp: lastTs || ''
        };
      });
    },
    []
  );

  return useKubeQuery<EventData>(K8S_RESOURCE_KEYS.EVENTS, transform, enabled);
}

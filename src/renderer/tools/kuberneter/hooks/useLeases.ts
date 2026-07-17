import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type LeaseData } from '../types/LeaseData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useLeases(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const leaseItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          spec?: {
            holderIdentity?: string;
            leaseDurationSeconds?: number;
            renewTime?: string;
          };
        };

        const name = leaseItem.metadata?.name || '';
        const ns = leaseItem.metadata?.namespace || '';
        const holder = leaseItem.spec?.holderIdentity || '—';
        const durationSeconds = leaseItem.spec?.leaseDurationSeconds ?? 0;
        const renewTimeRaw = leaseItem.spec?.renewTime;
        const renewTime = renewTimeRaw ? new Date(renewTimeRaw).toLocaleString() : '—';
        const creationTimestamp = leaseItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          labels: leaseItem.metadata?.labels,
          annotations: leaseItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          holder,
          durationSeconds,
          renewTime
        };
      });
    },
    []
  );

  return useKubeQuery<LeaseData>('leases', transform, enabled);
}

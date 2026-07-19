import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type StorageClassData } from '../types/StorageClassData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface SCResource {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  provisioner?: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
}

export function useStorageClasses(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[], extraData?: unknown) => {
      const pvs = (extraData as K8sResource[]) || [];

      return items.map((item) => {
        const scItem = item as unknown as SCResource;
        const name = scItem.metadata?.name || '';

        const creationTimestamp = scItem.metadata?.creationTimestamp || '';
        const annotations = scItem.metadata?.annotations || {};

        const isDefault =
          annotations['storageclass.kubernetes.io/is-default-class'] === 'true' ||
          annotations['storageclass.beta.kubernetes.io/is-default-class'] === 'true';

        // Find associated PVs
        const matchedPvs = pvs.filter((pv) => {
          const spec = pv.spec as { storageClassName?: string } | undefined;
          return spec?.storageClassName === name;
        });

        const pvInfos = matchedPvs.map((pv) => {
          const spec = pv.spec as { capacity?: { storage?: string } } | undefined;
          const status = pv.status as { phase?: string } | undefined;
          return {
            name: pv.metadata?.name || '',
            capacity: spec?.capacity?.storage || '—',
            status: status?.phase || 'Unknown'
          };
        });

        return {
          id: name,
          name,
          provisioner: scItem.provisioner || '—',
          reclaimPolicy: scItem.reclaimPolicy || 'Delete',
          isDefault,
          volumeBindingMode: scItem.volumeBindingMode || 'Immediate',
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: scItem.metadata?.labels,
          annotations: scItem.metadata?.annotations,
          pvs: pvInfos,
          rawItem: item
        };
      });
    },
    []
  );

  const fetchExtraData = useMemo(
    () => async (configPath: string | undefined, cluster: string) => {
      try {
        const pvsRes = await window.kuberneter.getResources(
          configPath,
          cluster,
          'persistentvolumes'
        );
        return pvsRes?.items || [];
      } catch (e) {
        console.warn('Failed to fetch storage classes extra data (pvs)', e);
        return [];
      }
    },
    []
  );

  return useKubeQuery<StorageClassData>('storageclasses', transform, enabled, fetchExtraData);
}

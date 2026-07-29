import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { type PersistentVolumeClaimData } from '../types/PersistentVolumeClaimData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface PVCResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    finalizers?: string[];
  };
  spec?: {
    accessModes?: string[];
    resources?: {
      requests?: {
        storage?: string;
      };
    };
    storageClassName?: string;
    volumeName?: string;
    selector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: Array<{ key: string; operator: string; values?: string[] }>;
    };
  };
  status?: {
    phase?: string;
    capacity?: {
      storage?: string;
    };
  };
}

export function usePersistentVolumeClaims(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[], extraData?: unknown) => {
      const pods = (extraData as K8sResource[]) || [];

      return items.map((item) => {
        const pvcItem = item as unknown as PVCResource;
        const name = pvcItem.metadata?.name || '';
        const ns = pvcItem.metadata?.namespace || '';

        // Find matching pods
        const matchedPods = pods.filter((pod) => {
          if (pod.metadata?.namespace !== ns) return false;
          const spec = pod.spec as
            { volumes?: Array<{ persistentVolumeClaim?: { claimName?: string } }> } | undefined;
          return spec?.volumes?.some((v) => v.persistentVolumeClaim?.claimName === name);
        });
        const podNames = matchedPods.map((p) => p.metadata?.name || '').filter(Boolean);

        const creationTimestamp = pvcItem.metadata?.creationTimestamp || '';
        const capacity =
          pvcItem.status?.capacity?.storage || pvcItem.spec?.resources?.requests?.storage || '—';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          status: pvcItem.status?.phase || 'Unknown',
          volume: pvcItem.spec?.volumeName || '—',
          capacity,
          storageClass: pvcItem.spec?.storageClassName || '—',
          accessModes: pvcItem.spec?.accessModes || [],
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: pvcItem.metadata?.labels,
          annotations: pvcItem.metadata?.annotations,
          finalizers: pvcItem.metadata?.finalizers,
          selector: pvcItem.spec?.selector,
          pods: podNames,
          rawItem: item
        };
      });
    },
    []
  );

  const fetchExtraData = useMemo(
    () => async (configPath: string | undefined, cluster: string, ns: string) => {
      try {
        const podsRes = await window.kuberneter.getResources(
          configPath,
          cluster,
          K8S_RESOURCE_KEYS.PODS,
          ns
        );
        return podsRes?.items || [];
      } catch (e) {
        console.warn('Failed to fetch PVC extra data (pods)', e);
        return [];
      }
    },
    []
  );

  return useKubeQuery<PersistentVolumeClaimData>(
    K8S_RESOURCE_KEYS.PERSISTENT_VOLUME_CLAIMS,
    transform,
    enabled,
    fetchExtraData
  );
}

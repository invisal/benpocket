import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import {
  type PersistentVolumeData,
  type PersistentVolumeProvider,
  type PersistentVolumeClaimRef
} from '../types/PersistentVolumeData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface PVResource {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    finalizers?: string[];
  };
  spec?: {
    capacity?: {
      storage?: string;
    };
    accessModes?: string[];
    claimRef?: {
      kind?: string;
      name?: string;
      namespace?: string;
    };
    persistentVolumeReclaimPolicy?: string;
    storageClassName?: string;
    volumeMode?: string;
    csi?: {
      driver?: string;
      fsType?: string;
      readOnly?: boolean;
      volumeAttributes?: Record<string, string>;
    };
    hostPath?: {
      path?: string;
    };
  };
  status?: {
    phase?: string;
  };
}

export function usePersistentVolumes(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const pvItem = item as unknown as PVResource;
        const name = pvItem.metadata?.name || '';

        const creationTimestamp = pvItem.metadata?.creationTimestamp || '';
        const capacity = pvItem.spec?.capacity?.storage || '—';

        // Extract claimRef
        let claim: PersistentVolumeClaimRef | undefined;
        if (pvItem.spec?.claimRef) {
          claim = {
            kind: pvItem.spec.claimRef.kind || 'PersistentVolumeClaim',
            name: pvItem.spec.claimRef.name || '',
            namespace: pvItem.spec.claimRef.namespace || ''
          };
        }

        // Extract provider details
        let provider: PersistentVolumeProvider | undefined;
        if (pvItem.spec?.csi) {
          provider = {
            type: 'Container Storage Interface',
            driver: pvItem.spec.csi.driver,
            fsType: pvItem.spec.csi.fsType,
            readOnly: pvItem.spec.csi.readOnly,
            volumeAttributes: pvItem.spec.csi.volumeAttributes
          };
        } else if (pvItem.spec?.hostPath) {
          provider = {
            type: 'HostPath',
            path: pvItem.spec.hostPath.path
          };
        }

        return {
          id: name,
          name,
          status: pvItem.status?.phase || 'Unknown',
          capacity,
          storageClass: pvItem.spec?.storageClassName || '—',
          accessModes: pvItem.spec?.accessModes || [],
          reclaimPolicy: pvItem.spec?.persistentVolumeReclaimPolicy || '—',
          volumeMode: pvItem.spec?.volumeMode || 'Filesystem',
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: pvItem.metadata?.labels,
          annotations: pvItem.metadata?.annotations,
          finalizers: pvItem.metadata?.finalizers,
          provider,
          claim,
          rawItem: item
        };
      });
    },
    []
  );

  return useKubeQuery<PersistentVolumeData>(
    K8S_RESOURCE_KEYS.PERSISTENT_VOLUMES,
    transform,
    enabled
  );
}

import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { type ServiceAccountData } from '../types/ServiceAccountData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useServiceAccounts(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const saItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          secrets?: { name?: string }[];
          imagePullSecrets?: { name?: string }[];
        };

        const name = saItem.metadata?.name || '';
        const ns = saItem.metadata?.namespace || '';
        const creationTimestamp = saItem.metadata?.creationTimestamp || '';
        const secrets = (saItem.secrets || [])
          .map((s) => s.name)
          .filter((n): n is string => Boolean(n));
        const imagePullSecrets = (saItem.imagePullSecrets || [])
          .map((s) => s.name)
          .filter((n): n is string => Boolean(n));

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          secretsCount: secrets.length,
          secrets,
          imagePullSecrets,
          labels: saItem.metadata?.labels,
          annotations: saItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : ''
        };
      });
    },
    []
  );

  return useKubeQuery<ServiceAccountData>(K8S_RESOURCE_KEYS.SERVICE_ACCOUNTS, transform, enabled);
}

import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { formatAge } from '../../utils/formatAge';
import { type NamespaceData } from '../../types/NamespaceData';
import { type K8sResource } from '../../types/K8sResource';
import { K8S_RESOURCE_KEYS } from '../../constants/k8sResources';

export function useOpenNamespaceDetail() {
  const { openDetailTab, activeInstanceId } = useDetailTabOpener();
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const openNamespaceDetail = useCallback(
    async (namespaceName: string) => {
      if (!namespaceName) return;

      let payload: NamespaceData = {
        id: namespaceName,
        name: namespaceName,
        status: 'Active',
        age: '—',
        createdTime: ''
      };

      try {
        const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
        const res = await window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.NAMESPACES
        );
        const items = (res?.items || []) as K8sResource[];
        const item = items.find((i) => i.metadata?.name === namespaceName);
        if (item) {
          const creationTimestamp = item.metadata?.creationTimestamp || '';
          payload = {
            id: namespaceName,
            name: namespaceName,
            status: item.status?.phase || 'Active',
            age: formatAge(creationTimestamp),
            createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
            labels: item.metadata?.labels,
            annotations: item.metadata?.annotations,
            rawItem: item
          };
        }
      } catch (err) {
        console.warn('Failed to fetch namespace detail payload:', err);
      }

      openDetailTab({
        contentType: 'namespace',
        resourceTab: 'namespace-detail',
        name: namespaceName,
        title: `Namespace: ${namespaceName}`,
        payload
      });
    },
    [openDetailTab, cluster, rawConfigPath]
  );

  return { openNamespaceDetail };
}

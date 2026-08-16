import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { buildIngressDetailPayload } from './transformers/ingress.transformer';
import { type K8sResource } from '../../types/K8sResource';
import { K8S_RESOURCE_KEYS } from '../../constants/k8sResources';

export function useOpenIngressDetail() {
  const { openDetailTab, activeInstanceId } = useDetailTabOpener();
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const openIngressDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;

      let item = rawResource;
      if (!item && cluster) {
        const configPath = rawConfigPath === 'default' ? undefined : rawConfigPath;
        try {
          const res = await window.kuberneter.getResources(
            configPath,
            cluster,
            K8S_RESOURCE_KEYS.INGRESSES,
            namespace
          );
          item = ((res?.items || []) as K8sResource[]).find((i) => i.metadata?.name === name);
        } catch (e) {
          console.warn(`Failed to fetch Ingress ${name}:`, e);
        }
      }

      const payload = buildIngressDetailPayload(name, namespace, item);

      openDetailTab({
        contentType: 'ingresses',
        resourceTab: 'ingress-detail',
        name,
        namespace,
        title: `Ingress: ${name}`,
        payload
      });
    },
    [openDetailTab, cluster, rawConfigPath]
  );

  return { openIngressDetail };
}

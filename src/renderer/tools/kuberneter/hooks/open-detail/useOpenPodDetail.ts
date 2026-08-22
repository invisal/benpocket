import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { buildPodDetailPayload } from './transformers/pod.transformer';
import { type K8sResource } from '../../types/K8sResource';
import { K8S_RESOURCE_KEYS } from '../../constants/k8sResources';

export function useOpenPodDetail() {
  const { openDetailTab, activeInstanceId } = useDetailTabOpener();
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const openPodDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;

      let item = rawResource;
      if (!item && cluster) {
        const configPath = rawConfigPath === 'default' ? undefined : rawConfigPath;
        try {
          const res = await window.kuberneter.getResources(
            configPath,
            cluster,
            K8S_RESOURCE_KEYS.PODS,
            namespace
          );
          item = ((res?.items || []) as K8sResource[]).find((i) => i.metadata?.name === name);
        } catch (e) {
          console.warn(`Failed to fetch pod ${name}:`, e);
        }
      }

      const payload = buildPodDetailPayload(name, namespace, item);

      openDetailTab({
        contentType: 'pod',
        resourceTab: 'pod-detail',
        name,
        namespace,
        title: `Pod: ${name}`,
        payload
      });
    },
    [openDetailTab, cluster, rawConfigPath]
  );

  return { openPodDetail };
}

import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useKuberneterStore } from '../../store/kuberneter.store';
import {
  buildConfigMapDetailPayload,
  buildSecretDetailPayload,
  buildServiceAccountDetailPayload
} from './transformers/config.transformer';
import { type K8sResource } from '../../types/K8sResource';
import { K8S_RESOURCE_KEYS } from '../../constants/k8sResources';

export function useOpenConfigDetail() {
  const { openDetailTab, activeInstanceId } = useDetailTabOpener();
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const fetchResource = useCallback(
    async (
      resourceKey: string,
      namespace: string,
      name: string
    ): Promise<K8sResource | undefined> => {
      if (!cluster) return undefined;
      const configPath = rawConfigPath === 'default' ? undefined : rawConfigPath;
      try {
        const res = await window.kuberneter.getResources(
          configPath,
          cluster,
          resourceKey,
          namespace
        );
        return ((res?.items || []) as K8sResource[]).find((i) => i.metadata?.name === name);
      } catch (e) {
        console.warn(`Failed to fetch ${resourceKey}/${name}:`, e);
        return undefined;
      }
    },
    [cluster, rawConfigPath]
  );

  const openConfigMapDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.CONFIGMAPS, namespace, name));
      const payload = buildConfigMapDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'configmap',
        resourceTab: 'configmap-detail',
        name,
        namespace,
        title: `ConfigMap: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openSecretDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item = rawResource || (await fetchResource(K8S_RESOURCE_KEYS.SECRETS, namespace, name));
      const payload = buildSecretDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'secret',
        resourceTab: 'secret-detail',
        name,
        namespace,
        title: `Secret: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openServiceAccountDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.SERVICE_ACCOUNTS, namespace, name));
      const payload = buildServiceAccountDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'serviceaccount',
        resourceTab: 'serviceaccount-detail',
        name,
        namespace,
        title: `ServiceAccount: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  return {
    openConfigMapDetail,
    openSecretDetail,
    openServiceAccountDetail
  };
}

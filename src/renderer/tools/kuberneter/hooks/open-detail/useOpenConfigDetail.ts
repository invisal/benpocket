import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useKuberneterStore } from '../../store/kuberneter.store';
import {
  buildConfigMapDetailPayload,
  buildSecretDetailPayload,
  buildResourceQuotaDetailPayload,
  buildLimitRangeDetailPayload,
  buildHorizontalPodAutoscalerDetailPayload,
  buildPodDisruptionBudgetDetailPayload,
  buildPriorityClassDetailPayload,
  buildRuntimeClassDetailPayload,
  buildLeaseDetailPayload,
  buildMutatingWebhookDetailPayload,
  buildValidatingWebhookDetailPayload,
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
      namespace: string | undefined,
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

  const openResourceQuotaDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.RESOURCE_QUOTAS, namespace, name));
      const payload = buildResourceQuotaDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'resourcequota',
        resourceTab: 'resourcequota-detail',
        name,
        namespace,
        title: `ResourceQuota: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openLimitRangeDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.LIMIT_RANGES, namespace, name));
      const payload = buildLimitRangeDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'limitrange',
        resourceTab: 'limitrange-detail',
        name,
        namespace,
        title: `LimitRange: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openHpaDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource ||
        (await fetchResource(K8S_RESOURCE_KEYS.HORIZONTAL_POD_AUTOSCALERS, namespace, name));
      const payload = buildHorizontalPodAutoscalerDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'horizontalpodautoscaler',
        resourceTab: 'horizontalpodautoscaler-detail',
        name,
        namespace,
        title: `HPA: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openPdbDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource ||
        (await fetchResource(K8S_RESOURCE_KEYS.POD_DISRUPTION_BUDGETS, namespace, name));
      const payload = buildPodDisruptionBudgetDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'poddisruptionbudget',
        resourceTab: 'poddisruptionbudget-detail',
        name,
        namespace,
        title: `PDB: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openPriorityClassDetail = useCallback(
    async (name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.PRIORITY_CLASSES, undefined, name));
      const payload = buildPriorityClassDetailPayload(name, item);
      openDetailTab({
        contentType: 'priorityclass',
        resourceTab: 'priorityclass-detail',
        name,
        title: `PriorityClass: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openRuntimeClassDetail = useCallback(
    async (name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.RUNTIME_CLASSES, undefined, name));
      const payload = buildRuntimeClassDetailPayload(name, item);
      openDetailTab({
        contentType: 'runtimeclass',
        resourceTab: 'runtimeclass-detail',
        name,
        title: `RuntimeClass: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openLeaseDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item = rawResource || (await fetchResource(K8S_RESOURCE_KEYS.LEASES, namespace, name));
      const payload = buildLeaseDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'lease',
        resourceTab: 'lease-detail',
        name,
        namespace,
        title: `Lease: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openMutatingWebhookDetail = useCallback(
    async (name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource ||
        (await fetchResource(K8S_RESOURCE_KEYS.MUTATING_WEBHOOK_CONFIGURATIONS, undefined, name));
      const payload = buildMutatingWebhookDetailPayload(name, item);
      openDetailTab({
        contentType: 'mutatingwebhook',
        resourceTab: 'mutatingwebhook-detail',
        name,
        title: `MutatingWebhook: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openValidatingWebhookDetail = useCallback(
    async (name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource ||
        (await fetchResource(K8S_RESOURCE_KEYS.VALIDATING_WEBHOOK_CONFIGURATIONS, undefined, name));
      const payload = buildValidatingWebhookDetailPayload(name, item);
      openDetailTab({
        contentType: 'validatingwebhook',
        resourceTab: 'validatingwebhook-detail',
        name,
        title: `ValidatingWebhook: ${name}`,
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
    openResourceQuotaDetail,
    openLimitRangeDetail,
    openHpaDetail,
    openHorizontalPodAutoscalerDetail: openHpaDetail,
    openPdbDetail,
    openPodDisruptionBudgetDetail: openPdbDetail,
    openPriorityClassDetail,
    openRuntimeClassDetail,
    openLeaseDetail,
    openMutatingWebhookDetail,
    openValidatingWebhookDetail,
    openServiceAccountDetail
  };
}

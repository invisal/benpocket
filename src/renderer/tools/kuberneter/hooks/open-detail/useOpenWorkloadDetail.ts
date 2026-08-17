import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useKuberneterStore } from '../../store/kuberneter.store';
import {
  buildDeploymentDetailPayload,
  buildDaemonSetDetailPayload,
  buildStatefulSetDetailPayload,
  buildReplicaSetDetailPayload,
  buildJobDetailPayload,
  buildCronJobDetailPayload
} from './transformers/workload.transformer';
import { type K8sResource } from '../../types/K8sResource';
import { K8S_RESOURCE_KEYS } from '../../constants/k8sResources';

export function useOpenWorkloadDetail() {
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

  const openDeploymentDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.DEPLOYMENTS, namespace, name));
      const payload = buildDeploymentDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'deployment',
        resourceTab: 'deployment-detail',
        name,
        namespace,
        title: `Deployment: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openDaemonSetDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.DAEMON_SETS, namespace, name));
      const payload = buildDaemonSetDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'daemonset',
        resourceTab: 'daemonset-detail',
        name,
        namespace,
        title: `DaemonSet: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openStatefulSetDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.STATEFUL_SETS, namespace, name));
      const payload = buildStatefulSetDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'statefulset',
        resourceTab: 'statefulset-detail',
        name,
        namespace,
        title: `StatefulSet: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openReplicaSetDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.REPLICA_SETS, namespace, name));
      const payload = buildReplicaSetDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'replicaset',
        resourceTab: 'replicaset-detail',
        name,
        namespace,
        title: `ReplicaSet: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openJobDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item = rawResource || (await fetchResource(K8S_RESOURCE_KEYS.JOBS, namespace, name));
      const payload = buildJobDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'job',
        resourceTab: 'job-detail',
        name,
        namespace,
        title: `Job: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openCronJobDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.CRON_JOBS, namespace, name));
      const payload = buildCronJobDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'cronjob',
        resourceTab: 'cronjob-detail',
        name,
        namespace,
        title: `CronJob: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  return {
    openDeploymentDetail,
    openDaemonSetDetail,
    openStatefulSetDetail,
    openReplicaSetDetail,
    openJobDetail,
    openCronJobDetail
  };
}

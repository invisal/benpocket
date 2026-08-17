import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useOpenNamespaceDetail } from './useOpenNamespaceDetail';
import { useOpenServiceDetail } from './useOpenServiceDetail';
import { useOpenPodDetail } from './useOpenPodDetail';
import { useOpenNodeDetail } from './useOpenNodeDetail';
import { useOpenWorkloadDetail } from './useOpenWorkloadDetail';
import { useOpenConfigDetail } from './useOpenConfigDetail';
import { useOpenStorageDetail } from './useOpenStorageDetail';
import { useOpenIngressDetail } from './useOpenIngressDetail';
import { type K8sResource } from '../../types/K8sResource';

export function useOpenResourceDetail() {
  const { openDetailTab } = useDetailTabOpener();
  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openServiceDetail } = useOpenServiceDetail();
  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();
  const {
    openDeploymentDetail,
    openDaemonSetDetail,
    openStatefulSetDetail,
    openReplicaSetDetail,
    openJobDetail,
    openCronJobDetail
  } = useOpenWorkloadDetail();
  const { openConfigMapDetail, openSecretDetail, openServiceAccountDetail } = useOpenConfigDetail();
  const { openPvcDetail } = useOpenStorageDetail();
  const { openIngressDetail } = useOpenIngressDetail();

  const openResourceDetail = useCallback(
    async (kind: string, namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;

      const normalizedKind = (kind || '').trim();
      const lowerKind = normalizedKind.toLowerCase();

      switch (lowerKind) {
        case 'namespace':
          return openNamespaceDetail(name);
        case 'service':
          return openServiceDetail(namespace, name);
        case 'pod':
          return openPodDetail(namespace, name, rawResource);
        case 'deployment':
          return openDeploymentDetail(namespace, name, rawResource);
        case 'daemonset':
          return openDaemonSetDetail(namespace, name, rawResource);
        case 'statefulset':
          return openStatefulSetDetail(namespace, name, rawResource);
        case 'replicaset':
        case 'replicasets':
          return openReplicaSetDetail(namespace, name, rawResource);
        case 'job':
          return openJobDetail(namespace, name, rawResource);
        case 'cronjob':
          return openCronJobDetail(namespace, name, rawResource);
        case 'configmap':
          return openConfigMapDetail(namespace, name, rawResource);
        case 'secret':
          return openSecretDetail(namespace, name, rawResource);
        case 'serviceaccount':
          return openServiceAccountDetail(namespace, name, rawResource);
        case 'ingress':
        case 'ingresses':
          return openIngressDetail(namespace, name, rawResource);
        case 'node':
        case 'nodes':
          return openNodeDetail(name, rawResource);
        case 'persistentvolumeclaim':
        case 'pvc':
          return openPvcDetail(namespace, name, rawResource);
        default: {
          const payload = rawResource || {
            metadata: { name, namespace },
            name,
            ns: namespace
          };
          openDetailTab({
            contentType: lowerKind,
            resourceTab: `${lowerKind}-detail`,
            name,
            namespace,
            title: `${normalizedKind}: ${name}`,
            payload
          });
          break;
        }
      }
    },
    [
      openNamespaceDetail,
      openServiceDetail,
      openPodDetail,
      openDeploymentDetail,
      openDaemonSetDetail,
      openStatefulSetDetail,
      openReplicaSetDetail,
      openJobDetail,
      openCronJobDetail,
      openConfigMapDetail,
      openSecretDetail,
      openServiceAccountDetail,
      openIngressDetail,
      openNodeDetail,
      openPvcDetail,
      openDetailTab
    ]
  );

  return {
    openNamespaceDetail,
    openServiceDetail,
    openResourceDetail
  };
}

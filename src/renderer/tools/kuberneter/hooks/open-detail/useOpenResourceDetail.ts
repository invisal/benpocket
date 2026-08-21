import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useOpenNamespaceDetail } from './useOpenNamespaceDetail';
import { useOpenPodDetail } from './useOpenPodDetail';
import { useOpenNodeDetail } from './useOpenNodeDetail';
import { useOpenWorkloadDetail } from './useOpenWorkloadDetail';
import { useOpenConfigDetail } from './useOpenConfigDetail';
import { useOpenStorageDetail } from './useOpenStorageDetail';
import { useOpenNetworkDetail } from './useOpenNetworkDetail';
import { type K8sResource } from '../../types/K8sResource';
import { type PortForwardData } from '../../types/PortForwardData';

export function useOpenResourceDetail() {
  const { openDetailTab } = useDetailTabOpener();
  const { openNamespaceDetail } = useOpenNamespaceDetail();
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
  const {
    openConfigMapDetail,
    openSecretDetail,
    openResourceQuotaDetail,
    openLimitRangeDetail,
    openHpaDetail,
    openPdbDetail,
    openPriorityClassDetail,
    openRuntimeClassDetail,
    openLeaseDetail,
    openMutatingWebhookDetail,
    openValidatingWebhookDetail,
    openServiceAccountDetail
  } = useOpenConfigDetail();
  const { openPvcDetail } = useOpenStorageDetail();
  const {
    openServiceDetail,
    openEndpointSliceDetail,
    openEndpointDetail,
    openIngressDetail,
    openIngressClassDetail,
    openNetworkPolicyDetail,
    openPortForwardingDetail
  } = useOpenNetworkDetail();

  const openResourceDetail = useCallback(
    async (kind: string, namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;

      const normalizedKind = (kind || '').trim();
      const lowerKind = normalizedKind.toLowerCase();

      switch (lowerKind) {
        case 'namespace':
        case 'namespaces':
          return openNamespaceDetail(name);
        case 'service':
        case 'services':
          return openServiceDetail(namespace, name);
        case 'pod':
        case 'pods':
          return openPodDetail(namespace, name, rawResource);
        case 'deployment':
        case 'deployments':
          return openDeploymentDetail(namespace, name, rawResource);
        case 'daemonset':
        case 'daemonsets':
          return openDaemonSetDetail(namespace, name, rawResource);
        case 'statefulset':
        case 'statefulsets':
          return openStatefulSetDetail(namespace, name, rawResource);
        case 'replicaset':
        case 'replicasets':
          return openReplicaSetDetail(namespace, name, rawResource);
        case 'job':
        case 'jobs':
          return openJobDetail(namespace, name, rawResource);
        case 'cronjob':
        case 'cronjobs':
          return openCronJobDetail(namespace, name, rawResource);
        case 'configmap':
        case 'configmaps':
          return openConfigMapDetail(namespace, name, rawResource);
        case 'secret':
        case 'secrets':
          return openSecretDetail(namespace, name, rawResource);
        case 'resourcequota':
        case 'resourcequotas':
        case 'quota':
        case 'quotas':
          return openResourceQuotaDetail(namespace, name, rawResource);
        case 'limitrange':
        case 'limitranges':
        case 'limits':
          return openLimitRangeDetail(namespace, name, rawResource);
        case 'horizontalpodautoscaler':
        case 'horizontalpodautoscalers':
        case 'hpa':
        case 'hpas':
          return openHpaDetail(namespace, name, rawResource);
        case 'poddisruptionbudget':
        case 'poddisruptionbudgets':
        case 'pdb':
        case 'pdbs':
          return openPdbDetail(namespace, name, rawResource);
        case 'priorityclass':
        case 'priorityclasses':
          return openPriorityClassDetail(name, rawResource);
        case 'runtimeclass':
        case 'runtimeclasses':
          return openRuntimeClassDetail(name, rawResource);
        case 'lease':
        case 'leases':
          return openLeaseDetail(namespace, name, rawResource);
        case 'mutatingwebhookconfiguration':
        case 'mutatingwebhookconfigurations':
        case 'mutatingwebhook':
        case 'mutatingwebhooks':
          return openMutatingWebhookDetail(name, rawResource);
        case 'validatingwebhookconfiguration':
        case 'validatingwebhookconfigurations':
        case 'validatingwebhook':
        case 'validatingwebhooks':
          return openValidatingWebhookDetail(name, rawResource);
        case 'serviceaccount':
        case 'serviceaccounts':
          return openServiceAccountDetail(namespace, name, rawResource);
        case 'ingress':
        case 'ingresses':
          return openIngressDetail(namespace, name, rawResource);
        case 'ingressclass':
        case 'ingressclasses':
          return openIngressClassDetail(name, rawResource);
        case 'endpointslice':
        case 'endpointslices':
          return openEndpointSliceDetail(namespace, name, rawResource);
        case 'endpoint':
        case 'endpoints':
          return openEndpointDetail(namespace, name, rawResource);
        case 'networkpolicy':
        case 'networkpolicies':
          return openNetworkPolicyDetail(namespace, name, rawResource);
        case 'portforward':
        case 'portforwarding':
          return openPortForwardingDetail(
            (rawResource as unknown as PortForwardData) || {
              id: `${namespace}/${name}`,
              name,
              ns: namespace,
              kind: 'Pod',
              podPort: 80,
              localPort: 80,
              protocol: 'TCP',
              status: 'Active',
              url: ''
            }
          );
        case 'node':
        case 'nodes':
          return openNodeDetail(name, rawResource);
        case 'persistentvolumeclaim':
        case 'pvc':
        case 'pvcs':
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
      openEndpointSliceDetail,
      openEndpointDetail,
      openIngressDetail,
      openIngressClassDetail,
      openNetworkPolicyDetail,
      openPortForwardingDetail,
      openPodDetail,
      openDeploymentDetail,
      openDaemonSetDetail,
      openStatefulSetDetail,
      openReplicaSetDetail,
      openJobDetail,
      openCronJobDetail,
      openConfigMapDetail,
      openSecretDetail,
      openResourceQuotaDetail,
      openLimitRangeDetail,
      openHpaDetail,
      openPdbDetail,
      openPriorityClassDetail,
      openRuntimeClassDetail,
      openLeaseDetail,
      openMutatingWebhookDetail,
      openValidatingWebhookDetail,
      openServiceAccountDetail,
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

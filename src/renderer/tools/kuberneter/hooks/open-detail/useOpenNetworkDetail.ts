import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useKuberneterStore } from '../../store/kuberneter.store';
import {
  buildServiceDetailPayload,
  buildEndpointSliceDetailPayload,
  buildEndpointDetailPayload,
  buildIngressDetailPayload,
  buildIngressClassDetailPayload,
  buildNetworkPolicyDetailPayload,
  buildPortForwardDetailPayload
} from './transformers/network.transformer';
import { type K8sResource } from '../../types/K8sResource';
import { type PortForwardData } from '../../types/PortForwardData';
import { K8S_RESOURCE_KEYS } from '../../constants/k8sResources';

export function useOpenNetworkDetail() {
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

  const openServiceDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      let item = rawResource;
      let targetNamespace = namespace;
      let epRes: K8sResource[] = [];
      let epsRes: K8sResource[] = [];

      try {
        if (!item && cluster) {
          const [svcRes, epResponse, epsResponse] = await Promise.all([
            window.kuberneter.getResources(
              configPathArg,
              cluster,
              K8S_RESOURCE_KEYS.SERVICES,
              targetNamespace
            ),
            window.kuberneter
              .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.ENDPOINTS, targetNamespace)
              .catch(() => ({ items: [] })),
            window.kuberneter
              .getResources(
                configPathArg,
                cluster,
                K8S_RESOURCE_KEYS.ENDPOINT_SLICES,
                targetNamespace
              )
              .catch(() => ({ items: [] }))
          ]);

          item = ((svcRes?.items || []) as K8sResource[]).find((i) => i.metadata?.name === name);
          epRes = (epResponse?.items || []) as K8sResource[];
          epsRes = (epsResponse?.items || []) as K8sResource[];

          // Fallback search across all namespaces if not found
          if (!item) {
            const allSvcRes = await window.kuberneter.getResources(
              configPathArg,
              cluster,
              K8S_RESOURCE_KEYS.SERVICES
            );
            const found = ((allSvcRes?.items || []) as K8sResource[]).find(
              (i) => i.metadata?.name === name
            );
            if (found && found.metadata?.namespace) {
              item = found;
              targetNamespace = found.metadata.namespace;
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch full service data for ${name}:`, err);
      }

      const payload = buildServiceDetailPayload(name, targetNamespace, item, epRes, epsRes);
      openDetailTab({
        contentType: 'service',
        resourceTab: 'service-detail',
        name,
        namespace: targetNamespace,
        title: `Service: ${name}`,
        payload
      });
    },
    [cluster, rawConfigPath, openDetailTab]
  );

  const openEndpointSliceDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.ENDPOINT_SLICES, namespace, name));
      const payload = buildEndpointSliceDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'endpointslice',
        resourceTab: 'endpointslice-detail',
        name,
        namespace,
        title: `EndpointSlice: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openEndpointDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.ENDPOINTS, namespace, name));
      const payload = buildEndpointDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'endpoints',
        resourceTab: 'endpoints-detail',
        name,
        namespace,
        title: `Endpoints: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openIngressDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.INGRESSES, namespace, name));
      const payload = buildIngressDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'ingresses',
        resourceTab: 'ingresses-detail',
        name,
        namespace,
        title: `Ingress: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openIngressClassDetail = useCallback(
    async (name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.INGRESS_CLASSES, undefined, name));
      const payload = buildIngressClassDetailPayload(name, item);
      openDetailTab({
        contentType: 'ingressclasses',
        resourceTab: 'ingressclasses-detail',
        name,
        title: `IngressClass: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openNetworkPolicyDetail = useCallback(
    async (namespace: string, name: string, rawResource?: K8sResource) => {
      if (!name) return;
      const item =
        rawResource || (await fetchResource(K8S_RESOURCE_KEYS.NETWORK_POLICIES, namespace, name));
      const payload = buildNetworkPolicyDetailPayload(name, namespace, item);
      openDetailTab({
        contentType: 'networkpolicies',
        resourceTab: 'networkpolicies-detail',
        name,
        namespace,
        title: `NetworkPolicy: ${name}`,
        payload
      });
    },
    [fetchResource, openDetailTab]
  );

  const openPortForwardingDetail = useCallback(
    (portForward: PortForwardData) => {
      if (!portForward?.name) return;
      const payload = buildPortForwardDetailPayload(portForward);
      openDetailTab({
        contentType: 'portforwarding',
        resourceTab: 'portforwarding-detail',
        name: portForward.name,
        namespace: portForward.ns,
        title: `PortForward: ${portForward.name}`,
        payload
      });
    },
    [openDetailTab]
  );

  return {
    openServiceDetail,
    openEndpointSliceDetail,
    openEndpointDetail,
    openIngressDetail,
    openIngressClassDetail,
    openNetworkPolicyDetail,
    openPortForwardingDetail
  };
}

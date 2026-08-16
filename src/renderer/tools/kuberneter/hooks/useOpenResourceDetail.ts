import { useCallback } from 'react';
import { useLayoutStore } from '@renderer/store/layout.store';
import { useKuberneterStore } from '../store/kuberneter.store';
import { formatAge } from '../utils/formatAge';
import { type NamespaceData } from '../types/NamespaceData';
import {
  type ServiceData,
  type ServiceEndpoint,
  type ServiceEndpointSlice
} from '../types/ServiceData';
import { type PodData } from '../types/PodData';
import { type PodResource, type ContainerStatus } from '../types/PodResource';
import { type DeployData } from '../types/DeployData';
import { type DaemonSetData } from '../types/DaemonSetData';
import { type StatefulSetData } from '../types/StatefulSetData';
import { type JobData } from '../types/JobData';
import { type CronJobData } from '../types/CronJobData';
import { type ConfigMapData } from '../types/ConfigMapData';
import { type SecretData } from '../types/SecretData';
import { type ServiceAccountData } from '../types/ServiceAccountData';
import { type IngressData, type IngressRuleData } from '../types/IngressData';
import { type K8sResource } from '../types/K8sResource';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';

interface RawServiceResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    finalizers?: string[];
  };
  spec?: {
    type?: string;
    clusterIP?: string;
    clusterIPs?: string[];
    ipFamilies?: string[];
    ipFamilyPolicy?: string;
    externalIPs?: string[];
    selector?: Record<string, string>;
    sessionAffinity?: string;
    ports?: Array<{
      port: number;
      protocol: string;
      nodePort?: number;
      targetPort?: number | string;
    }>;
  };
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>;
    };
  };
}

export function useOpenResourceDetail() {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const openTab = useLayoutStore((s) => s.openTab);
  const pinTab = useLayoutStore((s) => s.pinTab);

  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const openNamespaceDetail = useCallback(
    async (namespaceName: string) => {
      if (!activeInstanceId || !namespaceName) return;

      if (activeTabId) {
        pinTab(activeTabId);
      }

      const tabId = `kuberneter-namespace-detail-${namespaceName}-${activeInstanceId}`;

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

      openTab({
        id: tabId,
        title: `Namespace: ${namespaceName}`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: {
          resource: 'namespace-detail',
          payload
        }
      });
    },
    [activeInstanceId, activeTabId, cluster, rawConfigPath, openTab, pinTab]
  );

  const openServiceDetail = useCallback(
    async (namespace: string, serviceName: string) => {
      if (!activeInstanceId || !serviceName) return;

      if (activeTabId) {
        pinTab(activeTabId);
      }

      let targetNamespace = namespace;

      let payload: ServiceData = {
        id: `${targetNamespace}/${serviceName}`,
        name: serviceName,
        ns: targetNamespace,
        type: 'ClusterIP',
        clusterIp: '—',
        clusterIps: [],
        ipFamilies: [],
        ipFamilyPolicy: '—',
        externalIps: '—',
        selector: {},
        selectorStr: '',
        ports: '',
        sessionAffinity: 'None',
        age: '—',
        createdTime: '',
        status: 'Active',
        hasWarning: false,
        endpointSlices: [],
        endpoints: []
      };

      try {
        const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
        const [svcRes, epRes, epsRes] = await Promise.all([
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

        const rawItems = (svcRes?.items || []) as unknown as RawServiceResource[];
        let svcItem = rawItems.find((i) => i.metadata?.name === serviceName);

        // If not found in the initial namespace, fallback to searching all namespaces (e.g. metrics-server in custom namespace)
        if (!svcItem) {
          try {
            const allSvcRes = await window.kuberneter.getResources(
              configPathArg,
              cluster,
              K8S_RESOURCE_KEYS.SERVICES
            );
            const allItems = (allSvcRes?.items || []) as unknown as RawServiceResource[];
            const found = allItems.find((i) => i.metadata?.name === serviceName);
            if (found && found.metadata?.namespace) {
              svcItem = found;
              targetNamespace = found.metadata.namespace;
            }
          } catch {
            // Ignore fallback error
          }
        }

        if (svcItem) {
          const portsList = (svcItem.spec?.ports || []).map((p) => {
            let portStr = `${p.port}`;
            if (p.nodePort) {
              portStr += `:${p.nodePort}`;
            } else if (p.targetPort && String(p.targetPort) !== String(p.port)) {
              portStr += `:${p.targetPort}`;
            }
            return `${portStr}/${p.protocol}`;
          });
          const ports = portsList.join(', ');

          let externalIps = '—';
          const loadBalancerIngress = svcItem.status?.loadBalancer?.ingress || [];
          if (loadBalancerIngress.length > 0) {
            externalIps = loadBalancerIngress
              .map((i) => i.ip || i.hostname || '')
              .filter(Boolean)
              .join(', ');
            if (!externalIps) externalIps = '—';
          } else if (svcItem.spec?.externalIPs && svcItem.spec.externalIPs.length > 0) {
            externalIps = svcItem.spec.externalIPs.join(', ');
          }

          const selectorObj = svcItem.spec?.selector || {};
          const selectorStr = Object.entries(selectorObj)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');

          const endpoints = (epRes?.items || []) as K8sResource[];
          const matchedEndpointsObj = endpoints.find(
            (ep) => ep.metadata?.name === serviceName && ep.metadata?.namespace === targetNamespace
          ) as
            | {
                subsets?: Array<{
                  addresses?: Array<{ ip: string }>;
                  ports?: Array<{ port: number }>;
                }>;
              }
            | undefined;

          const endpointsList: ServiceEndpoint[] = [];
          if (matchedEndpointsObj?.subsets) {
            const ips: string[] = [];
            matchedEndpointsObj.subsets.forEach((sub) => {
              const subPorts = sub.ports || [];
              const addrs = sub.addresses || [];
              addrs.forEach((addr) => {
                if (subPorts.length > 0) {
                  subPorts.forEach((p) => ips.push(`${addr.ip}:${p.port}`));
                } else {
                  ips.push(addr.ip);
                }
              });
            });
            if (ips.length > 0) {
              endpointsList.push({ name: serviceName, endpoints: ips.join(', ') });
            }
          }

          const endpointSlices = (epsRes?.items || []) as K8sResource[];
          const matchedSlices = endpointSlices.filter(
            (es) =>
              es.metadata?.namespace === targetNamespace &&
              es.metadata?.labels?.['kubernetes.io/service-name'] === serviceName
          ) as unknown as Array<{
            metadata?: K8sResource['metadata'];
            addressType?: string;
            endpoints?: Array<{ conditions?: { ready?: boolean } }>;
            ports?: Array<{ port: number; protocol: string }>;
          }>;

          const endpointSlicesList: ServiceEndpointSlice[] = matchedSlices.map((slice) => {
            const endpointsArr = slice.endpoints || [];
            const total = endpointsArr.length;
            const ready = endpointsArr.filter((e) => e.conditions?.ready).length;
            const endpointsCount = `${ready}/${total}`;
            const addressType = slice.addressType || 'IPv4';
            const slicePorts =
              (slice.ports || []).map((p) => `${p.port}/${p.protocol}`).join(', ') || '—';
            return {
              name: slice.metadata?.name || '',
              endpointsCount,
              ports: slicePorts,
              addressType,
              age: formatAge(slice.metadata?.creationTimestamp || ''),
              creationTimestamp: slice.metadata?.creationTimestamp || ''
            };
          });

          const creationTimestamp = svcItem.metadata?.creationTimestamp || '';

          payload = {
            id: `${targetNamespace}/${serviceName}`,
            name: serviceName,
            ns: targetNamespace,
            type: svcItem.spec?.type || 'ClusterIP',
            clusterIp: svcItem.spec?.clusterIP || '—',
            clusterIps: svcItem.spec?.clusterIPs || [],
            ipFamilies: svcItem.spec?.ipFamilies || [],
            ipFamilyPolicy: svcItem.spec?.ipFamilyPolicy || '—',
            externalIps,
            selector: selectorObj,
            selectorStr,
            ports,
            sessionAffinity: svcItem.spec?.sessionAffinity || 'None',
            age: formatAge(creationTimestamp),
            createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
            annotations: svcItem.metadata?.annotations,
            finalizers: svcItem.metadata?.finalizers,
            status: 'Active',
            hasWarning: Object.keys(selectorObj).length > 0 && endpointsList.length === 0,
            endpointSlices: endpointSlicesList,
            endpoints: endpointsList
          };
        }
      } catch (err) {
        console.warn('Failed to fetch service detail payload:', err);
      }

      const tabId = `kuberneter-service-detail-${targetNamespace}-${serviceName}-${activeInstanceId}`;

      openTab({
        id: tabId,
        title: `Service: ${serviceName}`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: {
          resource: 'service-detail',
          payload
        }
      });
    },
    [activeInstanceId, activeTabId, cluster, rawConfigPath, openTab, pinTab]
  );

  const openResourceDetail = useCallback(
    async (kind: string, namespace: string, name: string, rawResource?: K8sResource) => {
      if (!activeInstanceId || !name) return;

      const normalizedKind = (kind || '').trim();
      const lowerKind = normalizedKind.toLowerCase();

      if (lowerKind === 'namespace') {
        return openNamespaceDetail(name);
      }

      if (lowerKind === 'service') {
        return openServiceDetail(namespace, name);
      }

      if (activeTabId) {
        pinTab(activeTabId);
      }

      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      let resourceItem = rawResource;
      if (!resourceItem) {
        const resourceMap: Record<string, string> = {
          pod: K8S_RESOURCE_KEYS.PODS,
          deployment: K8S_RESOURCE_KEYS.DEPLOYMENTS,
          daemonset: K8S_RESOURCE_KEYS.DAEMON_SETS,
          statefulset: K8S_RESOURCE_KEYS.STATEFUL_SETS,
          replicaset: K8S_RESOURCE_KEYS.REPLICA_SETS,
          job: K8S_RESOURCE_KEYS.JOBS,
          cronjob: K8S_RESOURCE_KEYS.CRON_JOBS,
          configmap: K8S_RESOURCE_KEYS.CONFIGMAPS,
          secret: K8S_RESOURCE_KEYS.SECRETS,
          serviceaccount: K8S_RESOURCE_KEYS.SERVICE_ACCOUNTS,
          ingress: K8S_RESOURCE_KEYS.INGRESSES,
          ingresses: K8S_RESOURCE_KEYS.INGRESSES,
          persistentvolumeclaim: K8S_RESOURCE_KEYS.PERSISTENT_VOLUME_CLAIMS,
          networkpolicy: K8S_RESOURCE_KEYS.NETWORK_POLICIES,
          horizontalpodautoscaler: K8S_RESOURCE_KEYS.HORIZONTAL_POD_AUTOSCALERS,
          hpa: K8S_RESOURCE_KEYS.HORIZONTAL_POD_AUTOSCALERS,
          poddisruptionbudget: K8S_RESOURCE_KEYS.POD_DISRUPTION_BUDGETS,
          pdb: K8S_RESOURCE_KEYS.POD_DISRUPTION_BUDGETS,
          limitrange: K8S_RESOURCE_KEYS.LIMIT_RANGES,
          resourcequota: K8S_RESOURCE_KEYS.RESOURCE_QUOTAS,
          role: K8S_RESOURCE_KEYS.ROLES,
          rolebinding: K8S_RESOURCE_KEYS.ROLE_BINDINGS,
          clusterrole: K8S_RESOURCE_KEYS.CLUSTER_ROLES,
          clusterrolebinding: K8S_RESOURCE_KEYS.CLUSTER_ROLE_BINDINGS
        };

        const resKey = resourceMap[lowerKind];
        if (resKey) {
          try {
            const res = await window.kuberneter.getResources(
              configPathArg,
              cluster,
              resKey,
              namespace || undefined
            );
            const items = (res?.items || []) as K8sResource[];
            resourceItem = items.find((i) => i.metadata?.name === name);
          } catch (err) {
            console.warn(`Failed to fetch ${lowerKind} resource:`, err);
          }
        }
      }

      let payload: unknown = resourceItem;
      let contentType = lowerKind;
      let resourceTab = `${lowerKind}-detail`;

      switch (lowerKind) {
        case 'pod': {
          contentType = 'pod';
          resourceTab = 'pod-detail';
          const podItem = resourceItem as unknown as PodResource;
          const initContainerStatuses = podItem?.status?.initContainerStatuses || [];
          const containerStatuses = podItem?.status?.containerStatuses || [];
          const restarts = [...initContainerStatuses, ...containerStatuses].reduce(
            (acc: number, c) => acc + (c.restartCount || 0),
            0
          );
          const containers = containerStatuses.map((c: ContainerStatus) => ({
            name: c.name,
            ready: !!c.ready
          }));
          const ownerRefs = podItem?.metadata?.ownerReferences || [];
          const controlledBy = ownerRefs.length > 0 ? ownerRefs[0].kind : '';
          const node = podItem?.spec?.nodeName || '';
          const qos = podItem?.status?.qosClass || '';
          const phase = podItem?.status?.phase || 'Unknown';
          const creationTimestamp = podItem?.metadata?.creationTimestamp || '';

          const podData: PodData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            status: phase,
            restarts,
            age: formatAge(creationTimestamp),
            rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
            controlledBy,
            node,
            qos,
            cpu: 'N/A',
            memory: 'N/A',
            containers,
            hasWarning: phase !== 'Running' && phase !== 'Succeeded',
            rawItem: podItem as unknown as K8sResource
          };
          payload = podData;
          break;
        }
        case 'deployment': {
          contentType = 'deployment';
          resourceTab = 'deployment-detail';
          const deployItem = resourceItem;
          const replicas = (deployItem?.spec?.replicas as number) ?? 0;
          const readyReplicas = (deployItem?.status?.readyReplicas as number) ?? 0;
          const upToDate = (deployItem?.status?.updatedReplicas as number) ?? 0;
          const available = (deployItem?.status?.availableReplicas as number) ?? 0;
          const creationTimestamp = deployItem?.metadata?.creationTimestamp || '';

          const deployData: DeployData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            ready: `${readyReplicas}/${replicas}`,
            replicas,
            upToDate,
            available,
            age: formatAge(creationTimestamp),
            rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
            status: readyReplicas === replicas ? 'Ready' : 'Progressing',
            strategy: (deployItem?.spec?.strategy as { type?: string })?.type || 'RollingUpdate',
            hasWarning: readyReplicas < replicas,
            rawItem: deployItem
          };
          payload = deployData;
          break;
        }
        case 'daemonset': {
          contentType = 'daemonset';
          resourceTab = 'daemonset-detail';
          const item = resourceItem;
          const desired = (item?.status?.desiredNumberScheduled as number) ?? 0;
          const current = (item?.status?.currentNumberScheduled as number) ?? 0;
          const ready = (item?.status?.numberReady as number) ?? 0;
          const upToDate = (item?.status?.updatedNumberScheduled as number) ?? 0;
          const available = (item?.status?.numberAvailable as number) ?? 0;
          const creationTimestamp = item?.metadata?.creationTimestamp || '';

          const daemonSetData: DaemonSetData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            desired,
            current,
            ready,
            upToDate,
            available,
            age: formatAge(creationTimestamp),
            rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
            nodeSelector: Object.entries(
              ((item?.spec?.template as { spec?: { nodeSelector?: Record<string, string> } })?.spec
                ?.nodeSelector as Record<string, string>) || {}
            )
              .map(([k, v]) => `${k}=${v}`)
              .join(', '),
            hasWarning: ready < desired
          };
          payload = daemonSetData;
          break;
        }
        case 'statefulset': {
          contentType = 'statefulset';
          resourceTab = 'statefulset-detail';
          const item = resourceItem;
          const replicas = (item?.spec?.replicas as number) ?? 0;
          const readyReplicas = (item?.status?.readyReplicas as number) ?? 0;
          const creationTimestamp = item?.metadata?.creationTimestamp || '';

          const statefulSetData: StatefulSetData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            replicas,
            ready: `${readyReplicas}/${replicas}`,
            age: formatAge(creationTimestamp),
            rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
            hasWarning: readyReplicas < replicas
          };
          payload = statefulSetData;
          break;
        }
        case 'job': {
          contentType = 'job';
          resourceTab = 'job-detail';
          const item = resourceItem;
          const desired = (item?.spec?.completions as number) ?? 1;
          const succeeded = (item?.status?.succeeded as number) ?? 0;
          const failed = (item?.status?.failed as number) ?? 0;
          const conditions =
            (item?.status?.conditions as Array<{ type?: string; status?: string }>) || [];
          const condStr =
            conditions
              .filter((c) => c.status === 'True')
              .map((c) => c.type)
              .join(', ') || (succeeded > 0 ? 'Complete' : failed > 0 ? 'Failed' : 'Running');
          const creationTimestamp = item?.metadata?.creationTimestamp || '';

          const jobData: JobData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            completions: `${succeeded}/${desired}`,
            succeeded,
            desired,
            age: formatAge(creationTimestamp),
            rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
            conditions: condStr,
            hasWarning: failed > 0
          };
          payload = jobData;
          break;
        }
        case 'cronjob': {
          contentType = 'cronjob';
          resourceTab = 'cronjob-detail';
          const item = resourceItem;
          const schedule = (item?.spec?.schedule as string) || '-';
          const suspend = (item?.spec?.suspend as boolean) ?? false;
          const rawActive = item?.status?.active as unknown;
          const active = Array.isArray(rawActive) ? rawActive.length : 0;
          const timeZone = (item?.spec?.timeZone as string) || '-';
          const lastScheduleTime = item?.status?.lastScheduleTime as string | undefined;
          const lastSchedule = lastScheduleTime ? formatAge(lastScheduleTime) : '-';
          const nextExecution = suspend ? 'N/A' : '-';
          const creationTimestamp = item?.metadata?.creationTimestamp || '';

          const cronJobData: CronJobData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            schedule,
            suspend,
            active,
            lastSchedule,
            nextExecution,
            timeZone,
            age: formatAge(creationTimestamp),
            rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
            hasWarning: active > 0 && suspend
          };
          payload = cronJobData;
          break;
        }
        case 'configmap': {
          contentType = 'configmap';
          resourceTab = 'configmap-detail';
          const keysList = Object.keys(resourceItem?.data || {});
          const creationTimestamp = resourceItem?.metadata?.creationTimestamp || '';

          const configMapData: ConfigMapData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            keysCount: keysList.length,
            keysList,
            data: resourceItem?.data as Record<string, string> | undefined,
            binaryData: resourceItem?.binaryData,
            labels: resourceItem?.metadata?.labels,
            annotations: resourceItem?.metadata?.annotations,
            age: formatAge(creationTimestamp)
          };
          payload = configMapData;
          break;
        }
        case 'secret': {
          contentType = 'secret';
          resourceTab = 'secret-detail';
          const keysList = Object.keys(resourceItem?.data || {});
          const creationTimestamp = resourceItem?.metadata?.creationTimestamp || '';

          const secretData: SecretData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            type: (resourceItem?.type as string) || 'Opaque',
            keysCount: keysList.length,
            keysList,
            data: resourceItem?.data as Record<string, string> | undefined,
            labels: resourceItem?.metadata?.labels,
            annotations: resourceItem?.metadata?.annotations,
            age: formatAge(creationTimestamp)
          };
          payload = secretData;
          break;
        }
        case 'serviceaccount': {
          contentType = 'serviceaccount';
          resourceTab = 'serviceaccount-detail';
          const rawSecrets = (resourceItem as { secrets?: Array<{ name: string }> })?.secrets || [];
          const rawImagePullSecrets =
            (resourceItem as { imagePullSecrets?: Array<{ name: string }> })?.imagePullSecrets ||
            [];
          const creationTimestamp = resourceItem?.metadata?.creationTimestamp || '';

          const serviceAccountData: ServiceAccountData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            secretsCount: rawSecrets.length,
            age: formatAge(creationTimestamp),
            createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
            labels: resourceItem?.metadata?.labels,
            annotations: resourceItem?.metadata?.annotations,
            secrets: rawSecrets.map((s) => s.name || '').filter(Boolean),
            imagePullSecrets: rawImagePullSecrets.map((s) => s.name || '').filter(Boolean),
            rawItem: resourceItem
          };
          payload = serviceAccountData;
          break;
        }
        case 'ingress':
        case 'ingresses': {
          contentType = 'ingresses';
          resourceTab = 'ingress-detail';
          const rawIng = resourceItem as unknown as {
            spec?: {
              rules?: Array<{
                host?: string;
                http?: {
                  paths?: Array<{
                    path?: string;
                    pathType?: string;
                    backend?: {
                      service?: { name?: string; port?: { number?: number; name?: string } };
                      serviceName?: string;
                      servicePort?: string | number;
                    };
                  }>;
                };
              }>;
              ingressClassName?: string;
            };
            status?: {
              loadBalancer?: {
                ingress?: Array<{
                  ip?: string;
                  hostname?: string;
                }>;
              };
            };
          };
          const rules = rawIng?.spec?.rules || [];
          const loadBalancerIngress = rawIng?.status?.loadBalancer?.ingress || [];
          const creationTimestamp = resourceItem?.metadata?.creationTimestamp || '';

          const lbList: string[] = [];
          loadBalancerIngress.forEach((lb) => {
            if (lb.ip) lbList.push(lb.ip);
            else if (lb.hostname) lbList.push(lb.hostname);
          });
          const loadBalancers = lbList.join(', ') || '—';

          const rulesList: IngressRuleData[] = [];
          const portList: string[] = [];
          const rulesStrList: string[] = [];

          rules.forEach((rule) => {
            const host = rule.host || '*';
            rule.http?.paths?.forEach((p) => {
              const path = p.path || '/';
              const serviceName = p.backend?.service?.name || p.backend?.serviceName || '—';
              const servicePort =
                p.backend?.service?.port?.number ||
                p.backend?.service?.port?.name ||
                p.backend?.servicePort ||
                '—';

              const link = `http://${host}${path}`;
              rulesList.push({
                host: rule.host || '',
                path,
                link,
                serviceName,
                servicePort: String(servicePort)
              });

              rulesStrList.push(`${link} → ${serviceName}:${servicePort}`);
              if (servicePort) {
                portList.push(String(servicePort));
              }
            });
          });

          const rulesStr = rulesStrList.join(', ') || '—';
          const ports = Array.from(new Set(portList)).join(', ') || '—';

          const ingressData: IngressData = {
            id: `${namespace}/${name}`,
            name,
            ns: namespace,
            loadBalancers,
            rules: rulesList,
            rulesStr,
            ports,
            age: formatAge(creationTimestamp),
            createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
            labels: resourceItem?.metadata?.labels,
            annotations: resourceItem?.metadata?.annotations,
            rawItem: resourceItem
          };
          payload = ingressData;
          break;
        }
        default: {
          payload = resourceItem || {
            metadata: { name, namespace },
            name,
            ns: namespace
          };
          break;
        }
      }

      const tabId = `kuberneter-${contentType}-detail-${namespace ? `${namespace}-` : ''}${name}-${activeInstanceId}`;

      openTab({
        id: tabId,
        title: `${normalizedKind}: ${name}`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: {
          resource: resourceTab,
          payload
        }
      });
    },
    [
      activeInstanceId,
      activeTabId,
      cluster,
      rawConfigPath,
      openTab,
      pinTab,
      openNamespaceDetail,
      openServiceDetail
    ]
  );

  return {
    openNamespaceDetail,
    openServiceDetail,
    openResourceDetail
  };
}

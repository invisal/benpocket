import { Age } from '../../Age';
import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  type ServiceData,
  type ServiceEndpointSlice,
  type ServiceEndpoint
} from '../../../types/ServiceData';
import { type PortForwardTunnelType } from '../../../types/PortForwardData';
import { type DeployRelatedPod } from '../../../types/DeployData';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import {
  useInstantMetrics,
  formatInstantCpu,
  formatInstantMemory
} from '../../../hooks/useMetrics';
import {
  useOpenNamespaceDetail,
  useOpenPodDetail,
  useOpenNodeDetail,
  useOpenNetworkDetail,
  useOpenResourceDetail
} from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { usePortForwardingStore } from '../../../store/portForwarding.store';
import { PortForwardDialog } from '../portforwarding/PortForwardDialog';
import { Button } from '@renderer/components/ui/Button';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { buildServiceDetailPayload } from '../../../hooks/open-detail/transformers/network.transformer';

interface ServiceDetailProps {
  payload: ServiceData;
  isTab?: boolean;
}

interface ServiceRelatedIngress {
  name: string;
  namespace: string;
  rules: string;
  age: string;
  creationTimestamp: string;
}

interface ServicePortItem {
  name?: string;
  port: number;
  protocol: string;
  nodePort?: number;
  targetPort?: number | string;
  displayStr: string;
}

export const ServiceDetail: React.FC<ServiceDetailProps> = ({ payload, isTab = false }) => {
  const [portForwardModalConfig, setPortForwardModalConfig] = useState<{
    isOpen: boolean;
    containerPort: number;
    protocol?: string;
  }>({ isOpen: false, containerPort: 80 });

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const portForwards = usePortForwardingStore((s) => s.portForwards);
  const addPortForward = usePortForwardingStore((s) => s.addPortForward);
  const removePortForward = usePortForwardingStore((s) => s.removePortForward);

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();
  const { openEndpointSliceDetail, openEndpointDetail, openIngressDetail } = useOpenNetworkDetail();
  const { openResourceDetail } = useOpenResourceDetail();

  const metricsQuery = useInstantMetrics(true);
  const metricItems = metricsQuery.data ?? [];

  // Live fetch with React Query
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'service-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const [svcRes, epRes, epsRes, podsRes, ingRes] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.SERVICES,
          payload.ns
        ),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.ENDPOINTS, payload.ns)
          .catch(() => ({ items: [] })),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.ENDPOINT_SLICES, payload.ns)
          .catch(() => ({ items: [] })),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.ns)
          .catch(() => ({ items: [] })),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.INGRESSES, payload.ns)
          .catch(() => ({ items: [] }))
      ]);

      const svcItem = ((svcRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const epItems = (epRes?.items || []) as K8sResource[];
      const epsItems = (epsRes?.items || []) as K8sResource[];
      const allPods = (podsRes?.items || []) as K8sResource[];
      const allIngresses = (ingRes?.items || []) as K8sResource[];

      const servicePayload = buildServiceDetailPayload(
        payload.name,
        payload.ns,
        svcItem || (payload.rawItem as K8sResource),
        epItems,
        epsItems
      );

      // Match pods with service selector
      const selector = servicePayload.selector || {};
      const selectorEntries = Object.entries(selector);
      const matchedPods =
        selectorEntries.length === 0
          ? []
          : allPods.filter((pod) => {
              if (pod.metadata?.namespace !== payload.ns) return false;
              const podLabels = pod.metadata?.labels || {};
              return selectorEntries.every(([k, v]) => podLabels[k] === v);
            });

      const podsList: DeployRelatedPod[] = matchedPods.map((pod) => {
        const podName = pod.metadata?.name || '';
        const node = (pod.spec?.nodeName as string) || '—';
        const containerStatuses =
          (pod.status?.containerStatuses as Array<{ ready?: boolean }>) || [];
        const readyCount = containerStatuses.filter((c) => c.ready).length;
        const totalCount = containerStatuses.length;
        const phase = (pod.status?.phase as string) || 'Unknown';
        return {
          name: podName,
          node,
          ns: payload.ns,
          ready: `${readyCount}/${totalCount}`,
          cpu: 'N/A',
          memory: 'N/A',
          status: phase,
          hasWarning: phase !== 'Running' && phase !== 'Succeeded',
          rawItem: pod
        };
      });

      // Find ingresses pointing to this service
      const relatedIngresses: ServiceRelatedIngress[] = [];
      allIngresses.forEach((ing) => {
        const ingName = ing.metadata?.name || '';
        const ingNs = ing.metadata?.namespace || payload.ns;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawIng = ing as any;
        const rules = rawIng?.spec?.rules || [];
        let pointsToService = false;
        const rulePaths: string[] = [];

        rules.forEach(
          (r: {
            host?: string;
            http?: {
              paths?: Array<{
                path?: string;
                backend?: { service?: { name?: string }; serviceName?: string };
              }>;
            };
          }) => {
            (r.http?.paths || []).forEach((p) => {
              const sName = p.backend?.service?.name || p.backend?.serviceName;
              if (sName === payload.name) {
                pointsToService = true;
                rulePaths.push(`${r.host || '*'}${p.path || ''}`);
              }
            });
          }
        );

        if (pointsToService) {
          relatedIngresses.push({
            name: ingName,
            namespace: ingNs,
            rules: rulePaths.join(', ') || '—',
            age: '',
            creationTimestamp: ing.metadata?.creationTimestamp || ''
          });
        }
      });

      return {
        servicePayload,
        podsList,
        relatedIngresses
      };
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const currentData = queryData?.servicePayload || payload;
  const pods = queryData?.podsList || [];
  const relatedIngresses = queryData?.relatedIngresses || [];

  const handleOpenPortForwardModal = useCallback((port: number, protocol?: string) => {
    setPortForwardModalConfig({
      isOpen: true,
      containerPort: port,
      protocol
    });
  }, []);

  const handleStopPortForward = useCallback(
    async (id: string) => {
      await window.kuberneter.stopPortForward(id);
      removePortForward(id);
    },
    [removePortForward]
  );

  const handleStartPortForward = useCallback(
    async (params: {
      localPort: number;
      openBrowser: boolean;
      tunnelType: PortForwardTunnelType;
    }) => {
      const { localPort, openBrowser, tunnelType } = params;
      const port = portForwardModalConfig.containerPort;
      const localUrl = `http://localhost:${localPort}`;
      const serviceName = currentData?.name || '';
      const serviceNs = currentData?.ns || '';
      const pfId = `pf-service-${serviceName}-${port}-${localPort}-${Date.now()}`;

      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const res = await window.kuberneter.startPortForward({
        id: pfId,
        kubeconfigPath: configPathArg,
        contextName: cluster || undefined,
        namespace: serviceNs,
        resourceKind: 'service',
        resourceName: serviceName,
        localPort: localPort,
        targetPort: port,
        kubectlPath: useKuberneterStore.getState().kuberneterKubectlPath || undefined,
        tunnelType
      });

      if (res.error) {
        addPortForward({
          id: pfId,
          name: serviceName,
          ns: serviceNs,
          kind: 'service',
          podPort: port,
          localPort: localPort,
          protocol: 'http',
          tunnelType,
          status: 'Error',
          url: localUrl
        });

        const isKubectlMissing =
          res.error.includes('KUBECTL_NOT_FOUND') ||
          res.error.toLowerCase().includes('kubectl') ||
          res.error.toLowerCase().includes('enoent') ||
          res.error.toLowerCase().includes('not found');

        if (isKubectlMissing) {
          useKuberneterStore
            .getState()
            .showKubectlMissingToast(
              'Port Forwarding requires the kubectl CLI executable. Please configure kubectl in Settings.'
            );
        }
        return;
      }

      const activeUrl = res.publicUrl || localUrl;

      addPortForward({
        id: pfId,
        name: serviceName,
        ns: serviceNs,
        kind: 'service',
        podPort: port,
        localPort: localPort,
        protocol: 'http',
        tunnelType,
        publicUrl: res.publicUrl,
        status: 'Active',
        url: activeUrl
      });

      if (openBrowser) {
        window.open(activeUrl, '_blank');
      }
    },
    [
      portForwardModalConfig.containerPort,
      currentData?.name,
      currentData?.ns,
      rawConfigPath,
      cluster,
      addPortForward
    ]
  );

  const rawPortsItem = (queryData?.servicePayload?.rawItem || payload?.rawItem) as
    K8sResource | undefined;
  const currentPortsString = currentData?.ports;

  const servicePorts = useMemo<ServicePortItem[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = rawPortsItem as any;
    if (raw?.spec?.ports && Array.isArray(raw.spec.ports) && raw.spec.ports.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return raw.spec.ports.map((p: any) => {
        let portStr = `${p.port}`;
        if (p.nodePort) {
          portStr += `:${p.nodePort}`;
        } else if (p.targetPort && String(p.targetPort) !== String(p.port)) {
          portStr += `:${p.targetPort}`;
        }
        const protocol = p.protocol || 'TCP';
        return {
          name: p.name,
          port: p.port,
          protocol,
          nodePort: p.nodePort,
          targetPort: p.targetPort,
          displayStr: `${portStr}/${protocol}`
        };
      });
    }

    if (currentPortsString && currentPortsString !== '—') {
      return currentPortsString.split(',').map((item) => {
        const trimmed = item.trim();
        const [portPart, protoPart] = trimmed.split('/');
        const firstPortStr = (portPart || '').split(':')[0];
        const parsedPort = parseInt(firstPortStr, 10) || 80;
        return {
          port: parsedPort,
          protocol: protoPart || 'TCP',
          displayStr: trimmed
        };
      });
    }

    return [];
  }, [rawPortsItem, currentPortsString]);

  const currentNs = currentData?.ns;
  const handleNamespaceClick = useCallback(() => {
    if (currentNs) {
      openNamespaceDetail(currentNs);
    }
  }, [currentNs, openNamespaceDetail]);

  if (!payload) {
    return <div className="p-4 text-sm text-zinc-500">No Service details available.</div>;
  }

  const annotations = currentData.annotations ? Object.entries(currentData.annotations) : [];
  const labels = currentData.labels ? Object.entries(currentData.labels) : [];
  const selectors = currentData.selector ? Object.entries(currentData.selector) : [];
  const finalizers = currentData.finalizers || [];
  const endpointSlices = currentData.endpointSlices || [];
  const endpoints = currentData.endpoints || [];

  const creationTimestamp =
    currentData.creationTimestamp ||
    (currentData as unknown as { rawItem?: { metadata?: { creationTimestamp?: string } } })?.rawItem
      ?.metadata?.creationTimestamp ||
    '';
  const createdTime =
    currentData.createdTime ||
    (creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '') ||
    'N/A';

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          {creationTimestamp ? <Age timestamp={creationTimestamp} /> : currentData.age || '—'} ago (
          {createdTime})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: currentData.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {currentData.ns}
        </span>
      )
    },
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Labels`,
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <div
              key={k}
              className="text-[10px] font-mono bg-surface-3/40 p-1 rounded border border-border/40 text-foreground break-all"
            >
              <span className="text-zinc-500 font-semibold">{k}:</span> {v}
            </div>
          ))}
        </div>
      )
    }
  ];

  if (currentData.controlledByName) {
    propertiesData.push({
      id: 'controlledBy',
      name: 'Controlled By',
      value: (
        <span>
          {currentData.controlledByKind || 'Owner'}{' '}
          <span
            onClick={() =>
              currentData.controlledByName &&
              openResourceDetail(
                currentData.controlledByKind || 'Deployment',
                currentData.ns,
                currentData.controlledByName
              )
            }
            className="text-accent hover:underline cursor-pointer font-mono"
          >
            {currentData.controlledByName}
          </span>
        </span>
      )
    });
  }

  if (selectors.length > 0) {
    propertiesData.push({
      id: 'selector',
      name: 'Selector',
      value: (
        <div className="flex flex-wrap gap-1">
          {selectors.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/70 text-zinc-300"
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    });
  }

  if (finalizers.length > 0) {
    propertiesData.push({
      id: 'finalizers',
      name: 'Finalizers',
      value: `${finalizers.length} Finalizers`,
      hasDetail: true,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {finalizers.map((f) => (
            <span
              key={f}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={f}
            >
              {f}
            </span>
          ))}
        </div>
      )
    });
  }

  propertiesData.push(
    {
      id: 'type',
      name: 'Type',
      value: currentData.type
    },
    {
      id: 'sessionAffinity',
      name: 'Session Affinity',
      value: currentData.sessionAffinity
    },
    {
      id: 'clusterIp',
      name: 'Cluster IP',
      value: currentData.clusterIp
    },
    {
      id: 'clusterIps',
      name: 'Cluster IPs',
      value: currentData.clusterIps?.join(', ') || '—'
    },
    {
      id: 'ipFamilies',
      name: 'IP Families',
      value: currentData.ipFamilies?.join(', ') || '—'
    },
    {
      id: 'ipFamilyPolicy',
      name: 'IP Family Policy',
      value: currentData.ipFamilyPolicy
    },
    {
      id: 'externalIps',
      name: 'External IPs',
      value: currentData.externalIps
    },
    {
      id: 'ports',
      name: 'Ports',
      value:
        servicePorts.length === 0 ? (
          <span className="font-mono text-zinc-500 text-[11px]">—</span>
        ) : (
          <div className="flex flex-col gap-1.5 w-full py-0.5">
            {servicePorts.map((p, idx) => {
              const activePf = portForwards.find(
                (pf) =>
                  pf.name === currentData.name &&
                  pf.ns === currentData.ns &&
                  (pf.kind === 'service' || pf.kind === 'svc') &&
                  pf.podPort === p.port &&
                  pf.status === 'Active'
              );
              return (
                <div
                  key={`${p.port}-${p.protocol}-${idx}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    {activePf ? (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={activePf.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline font-semibold flex items-center gap-1"
                          title={`Open ${activePf.url}`}
                        >
                          <span>{p.displayStr}</span>
                          {activePf.tunnelType === 'cloudflare' && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-sans font-normal border border-amber-500/30">
                              CF Tunnel
                            </span>
                          )}
                          {activePf.tunnelType === 'ngrok' && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-sans font-normal border border-blue-500/30">
                              ngrok
                            </span>
                          )}
                        </a>
                      </div>
                    ) : (
                      <span className="text-accent">{p.displayStr}</span>
                    )}
                    {p.name && !p.displayStr.includes(`:${p.name}/`) && (
                      <span className="text-zinc-500 text-[10px]">({p.name})</span>
                    )}
                  </div>
                  <div>
                    {activePf ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStopPortForward(activePf.id)}
                        className="h-5 px-2 py-0 text-[10px] font-medium bg-rose-600/80 hover:bg-rose-600 text-white"
                      >
                        Stop/Remove
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPortForwardModal(p.port, p.protocol)}
                        className="h-5 px-2 py-0 text-[10px] text-zinc-400 hover:text-foreground hover:bg-surface-3"
                      >
                        Forward...
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
    }
  );

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Endpoint Slices */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Endpoint Slices ({endpointSlices.length})
        </span>
        {endpointSlices.length === 0 ? (
          <div className="text-sm text-zinc-500 italic pl-1">No endpoint slices found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-[160px]">
            <KubeTable<ServiceEndpointSlice>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'font-mono text-zinc-300 truncate max-w-[140px]',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openEndpointSliceDetail(currentData.ns, row.name);
                      }}
                      className="text-accent hover:underline cursor-pointer"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )
                },
                {
                  key: 'endpointsCount',
                  header: 'Endpoints',
                  className: 'font-mono text-zinc-450'
                },
                {
                  key: 'ports',
                  header: 'Ports',
                  className: 'font-mono text-accent'
                },
                {
                  key: 'addressType',
                  header: 'Address Type',
                  className: 'font-mono text-zinc-450'
                },
                {
                  key: 'age',
                  header: 'Age',
                  className: 'font-mono text-zinc-500',
                  render: (row) => (
                    <Age
                      timestamp={
                        (row as unknown as Record<string, unknown>).creationTimestamp as string
                      }
                    />
                  )
                }
              ]}
              data={endpointSlices}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Endpoints */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Endpoints ({endpoints.length})
        </span>
        {endpoints.length === 0 ? (
          <div className="text-sm text-zinc-500 italic pl-1">No endpoints found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-[160px]">
            <KubeTable<ServiceEndpoint>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'font-mono text-zinc-300 truncate max-w-[140px]',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openEndpointDetail(currentData.ns, row.name);
                      }}
                      className="text-accent hover:underline cursor-pointer"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )
                },
                {
                  key: 'endpoints',
                  header: 'Endpoints',
                  className: 'font-mono text-zinc-450 break-all select-text'
                }
              ]}
              data={endpoints}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Matching Pods Section */}
      {selectors.length > 0 && (
        <div className="flex flex-col gap-2 mt-2 border-t border-border-dark/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
              Matching Pods ({pods.length})
            </span>
          </div>
          {pods.length === 0 ? (
            <div className="text-sm text-zinc-500 italic pl-1">
              No matching pods found in namespace
            </div>
          ) : (
            <div className="border-y border-border/40 flex flex-col max-h-[220px] h-auto w-full overflow-y-auto">
              <KubeTable<DeployRelatedPod>
                columns={[
                  {
                    key: 'name',
                    header: 'Name',
                    className: 'py-2 px-3 text-zinc-200 font-semibold truncate max-w-[180px]',
                    render: (row) => (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          openPodDetail(
                            row.ns,
                            row.name,
                            (row as unknown as { rawItem?: K8sResource }).rawItem
                          );
                        }}
                        className="text-accent hover:underline cursor-pointer font-sans"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                    )
                  },
                  {
                    key: 'node',
                    header: 'Node',
                    className: 'py-2 px-3 text-zinc-300 truncate max-w-[100px]',
                    render: (row) => (
                      <span
                        onClick={(e) => {
                          if (row.node && row.node !== '—') {
                            e.stopPropagation();
                            openNodeDetail(row.node);
                          }
                        }}
                        className={
                          row.node && row.node !== '—'
                            ? 'text-accent hover:underline cursor-pointer font-mono'
                            : 'text-zinc-400'
                        }
                        title={row.node}
                      >
                        {row.node}
                      </span>
                    )
                  },
                  {
                    key: 'ns',
                    header: 'Namespace',
                    className: 'py-2 px-3 text-accent hover:underline cursor-pointer',
                    render: (row) => <span onClick={handleNamespaceClick}>{row.ns}</span>
                  },
                  {
                    key: 'ready',
                    header: 'Ready',
                    className: 'py-2 px-3 text-zinc-300'
                  },
                  {
                    key: 'cpu',
                    header: 'CPU',
                    className: 'py-2 px-3 font-mono text-zinc-300 text-sm',
                    render: (row) => {
                      const podMetric = metricItems.find(
                        (p) => p.name === row.name && (!p.namespace || p.namespace === row.ns)
                      );
                      const cpuStr = podMetric?.cpu
                        ? formatInstantCpu(podMetric.cpu)
                        : row.cpu && row.cpu !== 'N/A'
                          ? row.cpu
                          : 'N/A';
                      return <span>{cpuStr}</span>;
                    }
                  },
                  {
                    key: 'memory',
                    header: 'Memory',
                    className: 'py-2 px-3 font-mono text-zinc-300 text-sm',
                    render: (row) => {
                      const podMetric = metricItems.find(
                        (p) => p.name === row.name && (!p.namespace || p.namespace === row.ns)
                      );
                      const memStr = podMetric?.memory
                        ? formatInstantMemory(podMetric.memory)
                        : row.memory && row.memory !== 'N/A'
                          ? row.memory
                          : 'N/A';
                      return <span>{memStr}</span>;
                    }
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    className: 'py-2 px-3 font-semibold text-sm',
                    render: (row) => (
                      <span
                        className={
                          row.status === 'Running' || row.status === 'Succeeded'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        {row.status}
                      </span>
                    )
                  }
                ]}
                data={pods}
                getRowKey={(row) => row.name}
                resizable={false}
              />
            </div>
          )}
        </div>
      )}

      {/* Ingresses Section */}
      {relatedIngresses.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            Ingresses ({relatedIngresses.length})
          </span>
          <div className="border-y border-border/40 flex flex-col h-auto max-h-[160px]">
            <KubeTable<ServiceRelatedIngress>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'font-mono text-zinc-300 truncate max-w-[160px]',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openIngressDetail(row.namespace, row.name);
                      }}
                      className="text-accent hover:underline cursor-pointer"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )
                },
                {
                  key: 'namespace',
                  header: 'Namespace',
                  className: 'font-mono text-accent hover:underline cursor-pointer',
                  render: (row) => <span onClick={handleNamespaceClick}>{row.namespace}</span>
                },
                {
                  key: 'rules',
                  header: 'Rules',
                  className: 'font-mono text-zinc-400'
                },
                {
                  key: 'age',
                  header: 'Age',
                  className: 'font-mono text-zinc-500',
                  render: (row) => <Age timestamp={row.creationTimestamp} />
                }
              ]}
              data={relatedIngresses}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
        </div>
      )}

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-sm text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>

      <PortForwardDialog
        isOpen={portForwardModalConfig.isOpen}
        onClose={() => setPortForwardModalConfig((prev) => ({ ...prev, isOpen: false }))}
        resourceName={currentData.name}
        namespace={currentData.ns}
        containerPort={portForwardModalConfig.containerPort}
        onStart={handleStartPortForward}
      />
    </div>
  );
};

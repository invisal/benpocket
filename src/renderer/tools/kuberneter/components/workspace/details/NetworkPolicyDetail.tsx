import type React from 'react';
import { useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type NetworkPolicyData } from '../../../types/NetworkPolicyData';
import { type DeployRelatedPod } from '../../../types/DeployData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { KubeTable } from '../../kubeTable';
import { Age } from '../../Age';
import {
  useInstantMetrics,
  formatInstantCpu,
  formatInstantMemory
} from '../../../hooks/useMetrics';
import {
  useOpenNamespaceDetail,
  useOpenPodDetail,
  useOpenNodeDetail
} from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { buildNetworkPolicyDetailPayload } from '../../../hooks/open-detail/transformers/network.transformer';

interface NetworkPolicyDetailProps {
  payload: NetworkPolicyData;
  isTab?: boolean;
}

export const NetworkPolicyDetail: React.FC<NetworkPolicyDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();

  const metricsQuery = useInstantMetrics(true);
  const metricItems = metricsQuery.data ?? [];

  // Live query for NetworkPolicy and matching Pods
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'networkpolicy-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const [npRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.NETWORK_POLICIES,
          payload.ns
        ),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.ns)
          .catch(() => ({ items: [] }))
      ]);

      const npItem = ((npRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allPods = (podsRes?.items || []) as K8sResource[];

      const networkPolicyPayload = buildNetworkPolicyDetailPayload(
        payload.name,
        payload.ns,
        npItem || (payload.rawItem as K8sResource)
      );

      // Match pods with podSelector
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (npItem || payload.rawItem) as any;
      const matchLabels = raw?.spec?.podSelector?.matchLabels || {};
      const labelEntries = Object.entries(matchLabels);

      const matchedPods = allPods.filter((pod) => {
        if (pod.metadata?.namespace !== payload.ns) return false;
        const podLabels = pod.metadata?.labels || {};
        if (labelEntries.length === 0) return true; // Empty selector matches all pods in namespace
        return labelEntries.every(([k, v]) => podLabels[k] === v);
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

      return {
        networkPolicyPayload,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const currentData = queryData?.networkPolicyPayload || payload;
  const pods = queryData?.podsList || [];

  const handleNamespaceClick = useCallback(
    (ns?: string) => {
      const targetNs = ns || currentData?.ns;
      if (targetNs) {
        openNamespaceDetail(targetNs);
      }
    },
    [currentData, openNamespaceDetail]
  );

  if (!payload) {
    return <div className="p-4 text-sm text-zinc-500">No Network Policy details available.</div>;
  }

  const annotations = currentData.annotations ? Object.entries(currentData.annotations) : [];
  const ingressRules = currentData.ingressRules || [];
  const egressRules = currentData.egressRules || [];
  const podSelectors = currentData.podSelectorStr
    ? currentData.podSelectorStr.split(', ').filter((s) => s && s !== '{}' && s !== '—')
    : [];

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
          onClick={() => handleNamespaceClick()}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {currentData.ns}
        </span>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1 select-text w-full">
          {annotations.map(([k, v]) => (
            <div
              key={k}
              className="flex flex-col gap-0.5 bg-surface-3 border border-border/60 rounded p-1.5 font-mono text-[10px] w-full"
            >
              <span className="text-zinc-400 font-semibold break-all">{k}</span>
              <span className="text-zinc-350 break-all whitespace-normal">{v}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'podSelector',
      name: 'Pod Selector',
      value:
        podSelectors.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {podSelectors.map((sel) => (
              <span
                key={sel}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350"
              >
                {sel}
              </span>
            ))}
          </div>
        ) : (
          <span className="italic text-zinc-500">Selects all pods ({})</span>
        )
    }
  ];

  const showsIngress = currentData.policyTypes.includes('Ingress');
  const showsEgress = currentData.policyTypes.includes('Egress');

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Ingress Section */}
      {showsIngress && (
        <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            Ingress
          </span>

          {ingressRules.length === 0 ? (
            <div className="text-sm text-zinc-400 pl-1 py-1 italic border-b border-border/10">
              Isolating Ingress traffic: No ingress allowed (block all incoming traffic)
            </div>
          ) : (
            <div className="flex flex-col border border-border/45 rounded overflow-hidden bg-surface-2/15 select-text">
              {ingressRules.map((rule, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col text-sm text-zinc-300 p-2.5 ${
                    idx > 0 ? 'border-t border-border-dark/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between py-1 border-b border-border/10">
                    <span className="font-semibold text-zinc-400">Ports</span>
                    <span className="font-mono text-zinc-200">
                      {rule.ports && rule.ports.length > 0 ? rule.ports.join(', ') : 'All Ports'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    <span className="font-semibold text-zinc-450">From</span>
                    {rule.peers && rule.peers.length > 0 ? (
                      <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-accent/20">
                        {rule.peers.map((peer, pIdx) => {
                          const hasIpBlock = !!peer.ipBlock;
                          const hasNsSel = !!peer.namespaceSelector;
                          const hasPodSel = !!peer.podSelector;

                          return (
                            <div key={pIdx} className="flex flex-col gap-1">
                              {hasIpBlock && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">ipBlock</span>
                                  <span className="font-mono text-zinc-300">
                                    cidr: {peer.ipBlock?.cidr}
                                    {peer.ipBlock?.except && peer.ipBlock.except.length > 0
                                      ? `, except: ${peer.ipBlock.except.join(', ')}`
                                      : ''}
                                  </span>
                                </div>
                              )}
                              {hasNsSel && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">namespaceSelector</span>
                                  <span className="font-mono text-zinc-300">
                                    • {peer.namespaceSelector}
                                  </span>
                                </div>
                              )}
                              {hasPodSel && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">podSelector</span>
                                  <span className="font-mono text-zinc-300">
                                    • {peer.podSelector}
                                  </span>
                                </div>
                              )}
                              {!hasIpBlock && !hasNsSel && !hasPodSel && (
                                <span className="text-zinc-500 italic">All sources ({})</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic pl-2">All sources allowed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Egress Section */}
      {showsEgress && (
        <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            Egress
          </span>

          {egressRules.length === 0 ? (
            <div className="text-sm text-zinc-400 pl-1 py-1 italic border-b border-border/10">
              Isolating Egress traffic: No egress allowed (block all outgoing traffic)
            </div>
          ) : (
            <div className="flex flex-col border border-border/45 rounded overflow-hidden bg-surface-2/15 select-text">
              {egressRules.map((rule, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col text-sm text-zinc-300 p-2.5 ${
                    idx > 0 ? 'border-t border-border-dark/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between py-1 border-b border-border/10">
                    <span className="font-semibold text-zinc-400">Ports</span>
                    <span className="font-mono text-zinc-200">
                      {rule.ports && rule.ports.length > 0 ? rule.ports.join(', ') : 'All Ports'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    <span className="font-semibold text-zinc-450">To</span>
                    {rule.peers && rule.peers.length > 0 ? (
                      <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-accent/20">
                        {rule.peers.map((peer, pIdx) => {
                          const hasIpBlock = !!peer.ipBlock;
                          const hasNsSel = !!peer.namespaceSelector;
                          const hasPodSel = !!peer.podSelector;

                          return (
                            <div key={pIdx} className="flex flex-col gap-1">
                              {hasIpBlock && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">ipBlock</span>
                                  <span className="font-mono text-zinc-300">
                                    cidr: {peer.ipBlock?.cidr}
                                    {peer.ipBlock?.except && peer.ipBlock.except.length > 0
                                      ? `, except: ${peer.ipBlock.except.join(', ')}`
                                      : ''}
                                  </span>
                                </div>
                              )}
                              {hasNsSel && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">namespaceSelector</span>
                                  <span className="font-mono text-zinc-300">
                                    • {peer.namespaceSelector}
                                  </span>
                                </div>
                              )}
                              {hasPodSel && (
                                <div className="flex items-start gap-1">
                                  <span className="text-zinc-500 font-mono">podSelector</span>
                                  <span className="font-mono text-zinc-300">
                                    • {peer.podSelector}
                                  </span>
                                </div>
                              )}
                              {!hasIpBlock && !hasNsSel && !hasPodSel && (
                                <span className="text-zinc-500 italic">All targets ({})</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic pl-2">All targets allowed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matching Pods Section */}
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
                  render: (row) => (
                    <span onClick={() => handleNamespaceClick(row.ns)}>{row.ns}</span>
                  )
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

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-sm text-zinc-500 italic pl-1 mt-0.5 font-sans">No events found</div>
      </div>
    </div>
  );
};

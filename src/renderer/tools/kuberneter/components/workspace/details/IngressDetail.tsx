import { Age } from '../../Age';
import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type IngressData } from '../../../types/IngressData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { KubeTable, type Column } from '../../kube-table';
import { MetricsSection } from './metrics';
import { Select } from '@renderer/components/ui/Select';
import {
  useOpenNamespaceDetail,
  useOpenNetworkDetail,
  useOpenConfigDetail,
  useOpenResourceDetail
} from '../../../hooks/open-detail';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { buildIngressDetailPayload } from '../../../hooks/open-detail/transformers/network.transformer';

interface IngressDetailProps {
  payload: IngressData;
  isTab?: boolean;
}

interface IngressTlsItem {
  hosts: string;
  secretName: string;
}

export const IngressDetail: React.FC<IngressDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openServiceDetail, openIngressClassDetail } = useOpenNetworkDetail();
  const { openSecretDetail } = useOpenConfigDetail();
  const { openResourceDetail: _openResourceDetail } = useOpenResourceDetail();

  // Live query for Ingress
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'ingress-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const [ingRes, svcRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.INGRESSES,
          payload.ns
        ),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.SERVICES, payload.ns)
          .catch(() => ({ items: [] })),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.ns)
          .catch(() => ({ items: [] }))
      ]);

      const ingItem = ((ingRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allServices = (svcRes?.items || []) as K8sResource[];
      const allPods = (podsRes?.items || []) as K8sResource[];

      const ingressPayload = buildIngressDetailPayload(
        payload.name,
        payload.ns,
        ingItem || (payload.rawItem as K8sResource)
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (ingItem || payload.rawItem) as any;
      const ingressClassName =
        raw?.spec?.ingressClassName ||
        raw?.metadata?.annotations?.['kubernetes.io/ingress.class'] ||
        '';

      const tlsList: IngressTlsItem[] = (raw?.spec?.tls || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => ({
          hosts: (t.hosts || []).join(', ') || '—',
          secretName: t.secretName || '—'
        })
      );

      const defaultBackendSvc = raw?.spec?.defaultBackend?.service?.name;

      // Extract referenced backend service names
      const referencedServiceNames = new Set<string>();
      (raw?.spec?.rules || []).forEach((rule: any) => {
        (rule.http?.paths || []).forEach((p: any) => {
          const sName = p.backend?.service?.name || p.backend?.serviceName;
          if (sName) referencedServiceNames.add(sName);
        });
      });
      if (defaultBackendSvc) referencedServiceNames.add(defaultBackendSvc);

      const matchedServices = allServices.filter(
        (s) =>
          s.metadata?.namespace === payload.ns &&
          referencedServiceNames.has(s.metadata?.name || '')
      );

      const selectors = matchedServices
        .map((s) => (s as any)?.spec?.selector)
        .filter((sel): sel is Record<string, string> => !!sel && Object.keys(sel).length > 0);

      const matchedPods = allPods.filter((pod) => {
        if (pod.metadata?.namespace !== payload.ns) return false;
        const podLabels = pod.metadata?.labels || {};
        return selectors.some((sel) =>
          Object.entries(sel).every(([k, v]) => podLabels[k] === v)
        );
      });

      const podsList = matchedPods.map((pod) => ({
        name: pod.metadata?.name || '',
        namespace: pod.metadata?.namespace || payload.ns,
        rawItem: pod
      }));

      return {
        ingressPayload,
        ingressClassName,
        tlsList,
        defaultBackendSvc,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const currentData = queryData?.ingressPayload || payload;
  const ingressClassName = queryData?.ingressClassName || '';
  const tlsList = queryData?.tlsList || [];
  const defaultBackendSvc = queryData?.defaultBackendSvc;

  const [selectedTarget, setSelectedTarget] = useState<string>('all');
  const pods = queryData?.podsList || [];
  const allPodNames = useMemo(() => pods.map((p) => p.name), [pods]);
  const targetPodNames = useMemo(() => {
    if (selectedTarget === 'all') return allPodNames;
    return pods.some((p) => p.name === selectedTarget) ? [selectedTarget] : allPodNames;
  }, [selectedTarget, allPodNames, pods]);

  const handleNamespaceClick = useCallback(() => {
    if (currentData?.ns) {
      openNamespaceDetail(currentData.ns);
    }
  }, [currentData, openNamespaceDetail]);

  const handleServiceClick = useCallback(
    (serviceName: string) => {
      if (currentData?.ns && serviceName && serviceName !== '—') {
        openServiceDetail(currentData.ns, serviceName);
      }
    },
    [currentData, openServiceDetail]
  );

  const handleIngressClassClick = useCallback(
    (className: string) => {
      if (className) {
        openIngressClassDetail(className);
      }
    },
    [openIngressClassDetail]
  );

  const handleSecretClick = useCallback(
    (secretName: string) => {
      if (currentData?.ns && secretName && secretName !== '—') {
        openSecretDetail(currentData.ns, secretName);
      }
    },
    [currentData, openSecretDetail]
  );

  const annotations = currentData?.annotations ? Object.entries(currentData.annotations) : [];
  const labels = currentData?.labels ? Object.entries(currentData.labels) : [];

  const creationTimestamp =
    currentData?.creationTimestamp ||
    (currentData as unknown as { rawItem?: { metadata?: { creationTimestamp?: string } } })?.rawItem?.metadata?.creationTimestamp ||
    '';
  const createdTime =
    currentData?.createdTime ||
    (creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '') ||
    'N/A';

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          {creationTimestamp ? (
            <Age timestamp={creationTimestamp} />
          ) : (
            currentData?.age || '—'
          )}{' '}
          ago ({createdTime})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: currentData?.name || ''
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: currentData ? (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {currentData.ns}
        </span>
      ) : (
        ''
      )
    }
  ];

  if (ingressClassName) {
    propertiesData.push({
      id: 'ingressClass',
      name: 'Ingress Class',
      value: (
        <span
          onClick={() => handleIngressClassClick(ingressClassName)}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {ingressClassName}
        </span>
      )
    });
  }

  if (labels.length > 0) {
    propertiesData.push({
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Labels`,
      hasDetail: true,
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
    });
  }

  propertiesData.push({
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
            <span className="text-zinc-355 break-all whitespace-normal">{v}</span>
          </div>
        ))}
      </div>
    )
  });

  if (defaultBackendSvc) {
    propertiesData.push({
      id: 'defaultBackend',
      name: 'Default Backend',
      value: (
        <span
          onClick={() => handleServiceClick(defaultBackendSvc)}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {defaultBackendSvc}
        </span>
      )
    });
  }

  propertiesData.push(
    {
      id: 'ports',
      name: 'Ports',
      value: currentData?.ports || '—'
    },
    {
      id: 'loadBalancers',
      name: 'Load Balancers',
      value: currentData?.loadBalancers || '—'
    }
  );

  // Map rules into details table rows
  const rulesTableData = useMemo(() => {
    if (!currentData?.rules) return [];
    return currentData.rules.map((r, idx) => ({
      id: `rule-${idx}`,
      host: r.host,
      path: r.path,
      link: r.link,
      serviceName: r.serviceName,
      servicePort: r.servicePort,
      backends: `${r.serviceName}:${r.servicePort}`
    }));
  }, [currentData?.rules]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ruleColumns = useMemo<Column<any>[]>(
    () => [
      {
        key: 'path',
        header: 'Path',
        render: (row) => <span className="font-mono text-zinc-300">{row.path}</span>,
        initialWidth: 150
      },
      {
        key: 'link',
        header: 'Link',
        render: (row) => (
          <span className="font-mono text-zinc-300">
            {row.link ? (
              <a
                href={row.link}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                {row.link}
              </a>
            ) : (
              row.host || '—'
            )}
          </span>
        ),
        initialWidth: 240
      },
      {
        key: 'backends',
        header: 'Backends',
        render: (row) => (
          <span className="font-mono text-zinc-300">
            {row.serviceName && row.serviceName !== '—' ? (
              <>
                <span
                  onClick={() => handleServiceClick(row.serviceName)}
                  className="text-accent hover:underline cursor-pointer"
                >
                  {row.serviceName}
                </span>
                {row.servicePort && row.servicePort !== '—' && (
                  <span className="text-zinc-400">:{row.servicePort}</span>
                )}
              </>
            ) : (
              '—'
            )}
          </span>
        ),
        initialWidth: 200
      }
    ],
    [handleServiceClick]
  );

  // TLS columns
  const tlsColumns = useMemo<Column<IngressTlsItem>[]>(
    () => [
      {
        key: 'hosts',
        header: 'Hosts',
        className: 'font-mono text-zinc-300 truncate max-w-[200px]',
        render: (row) => <span>{row.hosts}</span>,
        initialWidth: 220
      },
      {
        key: 'secretName',
        header: 'Secret',
        className: 'font-mono text-accent truncate max-w-[200px]',
        render: (row) =>
          row.secretName && row.secretName !== '—' ? (
            <span
              onClick={() => handleSecretClick(row.secretName)}
              className="hover:underline cursor-pointer"
            >
              {row.secretName}
            </span>
          ) : (
            <span className="text-zinc-500">—</span>
          ),
        initialWidth: 220
      }
    ],
    [handleSecretClick]
  );

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Ingress details available.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Metrics Section */}
      <div className="flex flex-col gap-2">
        {pods.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Metrics
            </span>
            <Select.Root
              value={selectedTarget}
              onValueChange={(val) => val && setSelectedTarget(val)}
            >
              <Select.Trigger
                variant="outline"
                className="w-24 h-5 text-[10px] font-mono px-1.5 py-0 bg-surface-3 border border-border/60 rounded text-foreground flex items-center justify-between gap-1 outline-none shadow-none font-normal"
              >
                <Select.Value>
                  {(value: string) => (value === 'all' ? `All (${pods.length})` : value)}
                </Select.Value>
              </Select.Trigger>
              <Select.Content
                side="bottom"
                align="end"
                className="min-w-[140px] max-w-[260px] text-[10px] font-mono"
              >
                <Select.Item value="all" className="text-[10px] font-mono py-1 px-2">
                  <Select.ItemText>All ({pods.length})</Select.ItemText>
                </Select.Item>
                {pods.map((p) => (
                  <Select.Item
                    key={p.name}
                    value={p.name}
                    className="text-[10px] font-mono py-1 px-2 truncate"
                  >
                    <Select.ItemText className="truncate">{p.name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
        )}
        <MetricsSection
          namespace={currentData?.ns}
          podNames={targetPodNames}
          resourceLabel="ingress"
        />
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Rules Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Rules ({rulesTableData.length})
        </span>

        {rulesTableData.length > 0 ? (
          <div className="flex flex-col border-y border-border/40 bg-surface-2/30 h-auto max-h-[180px]">
            <KubeTable
              columns={ruleColumns}
              data={rulesTableData}
              getRowKey={(row) => row.id}
              resizable={false}
              emptyMessage="No rules configured."
            />
          </div>
        ) : (
          <span className="text-xs text-zinc-500 italic px-1">No rules configured.</span>
        )}
      </div>

      {/* TLS Section */}
      {tlsList.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            TLS ({tlsList.length})
          </span>
          <div className="flex flex-col border-y border-border/40 bg-surface-2/30 h-auto max-h-[160px]">
            <KubeTable<IngressTlsItem>
              columns={tlsColumns}
              data={tlsList}
              getRowKey={(row) => `${row.hosts}-${row.secretName}`}
              resizable={false}
            />
          </div>
        </div>
      )}

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};

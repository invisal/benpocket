import { Age } from '../../Age';
import type React from 'react';
import { useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type IngressData } from '../../../types/IngressData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { KubeTable, type Column } from '../../kube-table';
import { MoreVertical, ChevronDown, ArrowUpDown, Sliders, Flag } from 'lucide-react';
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

      const ingRes = await window.kuberneter.getResources(
        configPathArg,
        cluster,
        K8S_RESOURCE_KEYS.INGRESSES,
        payload.ns
      );
      const ingItem = ((ingRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );

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

      return {
        ingressPayload,
        ingressClassName,
        tlsList,
        defaultBackendSvc
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
      <div className="flex flex-col gap-2 bg-surface-2/40 border border-border/40 rounded-lg p-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
          <span className="text-zinc-350">Metrics</span>
          <button className="text-zinc-500 hover:text-zinc-300 cursor-pointer border-none bg-transparent">
            <MoreVertical className="size-3.5" />
          </button>
        </div>

        {/* Metrics Toolbar */}
        <div className="flex items-center justify-between border-t border-border/20 pt-1.5 mt-0.5">
          <div className="flex items-center gap-1 bg-surface-3/50 px-2 py-0.5 border border-border/40 rounded text-xs text-zinc-350 cursor-pointer select-none">
            <span>1h</span>
            <ChevronDown className="size-3 text-zinc-500" />
          </div>
          <div className="flex items-center gap-2">
            <button className="text-zinc-500 hover:text-zinc-300 cursor-pointer border-none bg-transparent flex items-center justify-center p-0.5">
              <ArrowUpDown className="size-3.5" />
            </button>
            <button className="text-zinc-500 hover:text-zinc-300 cursor-pointer border-none bg-transparent flex items-center justify-center p-0.5">
              <Sliders className="size-3.5" />
            </button>
            <button className="text-zinc-500 hover:text-zinc-300 cursor-pointer border-none bg-transparent flex items-center justify-center p-0.5">
              <Flag className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500">
          Displaying metrics from Prometheus:{' '}
          <span className="text-accent underline cursor-pointer">monitoring</span> /{' '}
          <span className="text-accent underline cursor-pointer">prometheus-operated:9090</span>
        </div>

        {/* High-Fidelity Sparkline Chart Mockup with values and gridlines */}
        <div className="h-32 w-full bg-black/10 rounded border border-border-dark/30 relative flex flex-col justify-between p-2 select-none overflow-hidden mt-1">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-20">
            <div className="border-t border-zinc-500 w-full" />
            <div className="border-t border-zinc-500 w-full" />
            <div className="border-t border-zinc-500 w-full" />
            <div className="border-t border-zinc-500 w-full" />
            <div className="border-t border-zinc-500 w-full" />
            <div className="border-t border-zinc-500 w-full" />
          </div>

          <div className="absolute right-2 inset-y-2 flex flex-col justify-between text-[9px] font-mono text-zinc-500 text-right pointer-events-none z-10">
            <span>1.000</span>
            <span>0.800</span>
            <span>0.600</span>
            <span>0.400</span>
            <span>0.200</span>
            <span>0</span>
          </div>

          {/* Sparkline curve */}
          <svg
            className="w-full h-full absolute inset-0 overflow-hidden"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 110 Q 30 70 60 90 T 120 100 T 180 85 T 240 105 T 300 95 T 360 115 T 420 100 L 480 100 L 480 128 L 0 128 Z"
              fill="url(#ingGrad)"
              stroke="#3b82f6"
              strokeWidth="1.2"
              opacity="0.8"
            />
          </svg>

          {/* Empty spacer to align coordinates */}
          <div className="flex-1" />

          {/* Time axis */}
          <div className="flex justify-between text-[8px] font-mono text-zinc-500 z-10 w-[90%] border-t border-zinc-500/20 pt-1 pointer-events-none">
            <span>21:16</span>
            <span>21:22</span>
            <span>21:28</span>
            <span>21:34</span>
            <span>21:40</span>
            <span>21:46</span>
            <span>21:52</span>
            <span>21:58</span>
            <span>22:04</span>
            <span>22:10</span>
          </div>
        </div>
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

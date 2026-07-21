import { Age } from '../../Age';
import type React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { type ApplicationData } from '../../../types/ApplicationData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import type { Column } from '../../kubeTable';
import { type K8sResource } from '../../../types/K8sResource';
import { MoreVertical, Cpu, Layers, ArrowUpDown, Database, Flag } from 'lucide-react';

interface ApplicationDetailProps {
  payload: ApplicationData;
  isTab?: boolean;
}

interface ResourceItem {
  id: string;
  name: string;
  kind: string;
  component: string;
}

export const ApplicationDetail: React.FC<ApplicationDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const configPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const [loading, setLoading] = useState(true);
  const [allRelatedResources, setAllRelatedResources] = useState<
    (K8sResource & { kind: string })[]
  >([]);

  // Metric options
  const [timeRange, setTimeRange] = useState('1h');
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'network' | 'disk'>(
    'cpu'
  );

  const metricLabel = {
    cpu: 'CPU Usage',
    memory: 'Memory Usage',
    network: 'Network Traffic',
    disk: 'Disk I/O'
  }[selectedMetric];

  // Mock bar charts
  const mockBars = useMemo(() => {
    // Generate some wave-like bar heights
    const seed = selectedMetric === 'cpu' ? 12 : selectedMetric === 'memory' ? 24 : 8;
    return Array.from({ length: 44 }, (_, i) => {
      const h = Math.abs(Math.sin((i + seed) * 0.2)) * 60 + 5;
      return Math.min(100, Math.max(5, h));
    });
  }, [selectedMetric]);

  const handleNamespaceClick = useCallback(
    (ns: string) => {
      if (ns && activeInstanceId) {
        setNamespace(activeInstanceId, ns);
      }
    },
    [activeInstanceId, setNamespace]
  );

  // Fetch namespaced resources to match application group items
  useEffect(() => {
    if (!cluster || !activeInstanceId || !payload.namespace) return;

    let active = true;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const configPathArg = configPath === 'default' ? undefined : configPath;
        const resourcesToFetch = [
          { kind: 'Deployment', resource: 'deployments' },
          { kind: 'StatefulSet', resource: 'statefulsets' },
          { kind: 'DaemonSet', resource: 'daemonsets' },
          { kind: 'ConfigMap', resource: 'configmaps' },
          { kind: 'Secret', resource: 'secrets' },
          { kind: 'ServiceAccount', resource: 'serviceaccounts' },
          { kind: 'Service', resource: 'services' },
          { kind: 'Ingress', resource: 'ingresses' }
        ];

        const results = await Promise.all(
          resourcesToFetch.map(async ({ kind, resource }) => {
            try {
              const res = await window.kuberneter.getResources(
                configPathArg,
                cluster,
                resource,
                payload.namespace
              );
              const items = Array.isArray(res?.items) ? (res.items as K8sResource[]) : [];
              return items.map((item) => ({ ...item, kind }));
            } catch (err) {
              console.error(`Failed to fetch ${resource} in ApplicationDetail:`, err);
              return [];
            }
          })
        );

        if (active) {
          const flatItems = results.flat();
          setAllRelatedResources(flatItems);
        }
      } catch (err) {
        console.error('Error fetching application resources:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      active = false;
    };
  }, [cluster, configPath, activeInstanceId, payload.namespace]);

  // Match resources using application instance labels, Helm annotations, or names
  const matchedResources = useMemo(() => {
    return allRelatedResources.filter((item) => {
      const name = item.metadata?.name || '';
      const labels = item.metadata?.labels || {};
      const annotations = item.metadata?.annotations || {};

      // Match label selector keys
      if (
        labels['app.kubernetes.io/instance'] === payload.instance ||
        labels['app.kubernetes.io/name'] === payload.instance ||
        labels['app.kubernetes.io/part-of'] === payload.instance ||
        labels['app'] === payload.instance ||
        labels['release'] === payload.instance
      ) {
        return true;
      }

      // Helm release annotation
      if (
        annotations['meta.helm.sh/release-name'] === payload.instance ||
        labels['meta.helm.sh/release-name'] === payload.instance
      ) {
        return true;
      }

      // Name matches instance or starts with instance name prefix plus dash
      if (name === payload.instance || name.startsWith(`${payload.instance}-`)) {
        return true;
      }

      return false;
    });
  }, [allRelatedResources, payload.instance]);

  // Split into Workload Resources vs Other Resources
  const workloadResources = useMemo<ResourceItem[]>(() => {
    const kinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];
    return matchedResources
      .filter((item) => kinds.includes(item.kind))
      .map((item, idx) => ({
        id: `${item.kind}/${item.metadata?.name || idx}`,
        name: item.metadata?.name || '',
        kind: item.kind,
        component: item.metadata?.labels?.['app.kubernetes.io/component'] || ''
      }));
  }, [matchedResources]);

  const otherResources = useMemo<ResourceItem[]>(() => {
    const kinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];
    return matchedResources
      .filter((item) => !kinds.includes(item.kind))
      .map((item, idx) => ({
        id: `${item.kind}/${item.metadata?.name || idx}`,
        name: item.metadata?.name || '',
        kind: item.kind,
        component: item.metadata?.labels?.['app.kubernetes.io/component'] || ''
      }));
  }, [matchedResources]);

  // Generate internal URLs block
  const internalUrls = useMemo(() => {
    const services = otherResources.filter((r) => r.kind === 'Service');
    const urls: string[] = [];
    services.forEach((svc) => {
      urls.push('kubernetes.default.svc.cluster.local');
      urls.push(`${svc.name}.${payload.namespace}.svc.cluster.local`);
    });
    // Fallback if no services
    if (urls.length === 0) {
      urls.push('kubernetes.default.svc.cluster.local');
    }
    return Array.from(new Set(urls)).slice(0, 8);
  }, [otherResources, payload.namespace]);

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age timestamp={payload.creationTimestamp} /> ago ({payload.age || 'N/A'})
        </span>
      )
    },
    {
      id: 'status',
      name: 'Status',
      value: (
        <span
          className={
            payload.status === 'Running'
              ? 'text-emerald-500 font-semibold'
              : 'text-amber-500 font-semibold'
          }
        >
          {payload.status}
        </span>
      )
    },
    {
      id: 'application',
      name: 'Application',
      value: payload.application
    },
    {
      id: 'version',
      name: 'Version',
      value: payload.version || '—'
    },
    {
      id: 'managedBy',
      name: 'Managed By',
      value: payload.managedBy || '—'
    },
    {
      id: 'partOf',
      name: 'Part Of',
      value: '—'
    },
    {
      id: 'internalUrls',
      name: 'Internal URLs',
      value: `${internalUrls.length} URL(s)`,
      hasDetail: internalUrls.length > 0,
      renderDetail: () => (
        <div className="flex flex-col gap-1 pr-1 max-h-36 overflow-y-auto select-text">
          {internalUrls.map((url, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-355 truncate w-fit select-all"
              title={url}
            >
              {url}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'exposedUrls',
      name: 'Exposed URLs',
      value: (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 select-all">
          None
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.instance
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={() => handleNamespaceClick(payload.namespace)}
          className="text-accent hover:underline cursor-pointer font-mono text-xs"
        >
          {payload.namespace}
        </span>
      )
    }
  ];

  const resourceColumns = useMemo<Column<ResourceItem>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => <span className="text-zinc-300 font-sans text-xs">{row.name}</span>,
        className: 'text-zinc-300 font-sans max-w-[240px] truncate',
        initialWidth: 240
      },
      {
        key: 'kind',
        header: 'Kind',
        render: (row) => <span className="text-zinc-400 font-sans text-xs">{row.kind}</span>,
        className: 'text-zinc-400 font-sans max-w-[150px] truncate',
        initialWidth: 150
      },
      {
        key: 'component',
        header: 'Component',
        render: (row) => (
          <span className="text-zinc-400 font-sans text-xs">
            {row.component || <span className="text-zinc-650">—</span>}
          </span>
        ),
        className: 'text-zinc-400 font-sans max-w-[150px] truncate',
        initialWidth: 150
      }
    ],
    []
  );

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Metrics Section */}
      <div className="flex flex-col bg-surface-2/40 border border-border/40 rounded-lg p-3 select-none">
        <div className="flex justify-between items-center pb-2 border-b border-border/40 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
              Metrics
            </span>
            <MoreVertical className="size-3.5 text-zinc-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-surface-3 border border-border/60 rounded text-[10px] px-1 py-0.5 text-zinc-300 focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="1h">1h</option>
              <option value="6h">6h</option>
              <option value="24h">24h</option>
              <option value="7d">7d</option>
            </select>

            <span className="h-4 w-px bg-border/40 mx-1" />

            <button
              onClick={() => setSelectedMetric('cpu')}
              title="CPU"
              className={`p-1 rounded cursor-pointer border-none bg-transparent transition-colors ${
                selectedMetric === 'cpu'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Cpu className="size-3.5" />
            </button>
            <button
              onClick={() => setSelectedMetric('memory')}
              title="Memory"
              className={`p-1 rounded cursor-pointer border-none bg-transparent transition-colors ${
                selectedMetric === 'memory'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Layers className="size-3.5" />
            </button>
            <button
              onClick={() => setSelectedMetric('network')}
              title="Network"
              className={`p-1 rounded cursor-pointer border-none bg-transparent transition-colors ${
                selectedMetric === 'network'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ArrowUpDown className="size-3.5" />
            </button>
            <button
              onClick={() => setSelectedMetric('disk')}
              title="Disk"
              className={`p-1 rounded cursor-pointer border-none bg-transparent transition-colors ${
                selectedMetric === 'disk'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Database className="size-3.5" />
            </button>

            <span className="h-4 w-px bg-border/40 mx-1" />

            <button
              title="Filter"
              className="p-1 rounded cursor-pointer border-none bg-transparent text-zinc-555"
            >
              <Flag className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500 mb-2 pl-0.5">
          Displaying metrics from Prometheus:{' '}
          <span className="text-accent/80 hover:underline cursor-pointer">monitoring</span> /{' '}
          <span className="text-accent/80 hover:underline cursor-pointer">
            prometheus-operated:9090
          </span>
        </div>

        <div className="h-32 w-full bg-black/10 rounded border border-border-dark/30 relative flex flex-col justify-end p-2 pr-4">
          <div className="absolute left-2 top-2 bottom-6 flex flex-col justify-between text-[8px] font-mono text-zinc-650 select-none">
            <span>1.000</span>
            <span>0.800</span>
            <span>0.600</span>
            <span>0.400</span>
            <span>0.200</span>
            <span>0</span>
          </div>

          <div className="ml-10 flex-1 relative border-b border-l border-zinc-800/60 flex items-end justify-between px-0.5">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
            </div>

            {mockBars.map((val, idx) => (
              <div
                key={idx}
                className="w-1.5 bg-accent/60 rounded-t hover:bg-accent transition-colors"
                style={{ height: `${val}%` }}
                title={`${metricLabel}: ${val}%`}
              />
            ))}
          </div>

          <div className="ml-10 flex justify-between text-[8px] font-mono text-zinc-650 pt-1 select-none">
            <span>10:55</span>
            <span>11:02</span>
            <span>11:08</span>
            <span>11:14</span>
            <span>11:20</span>
            <span>11:26</span>
            <span>11:32</span>
            <span>11:38</span>
            <span>11:44</span>
            <span>11:50</span>
          </div>
        </div>
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Workload Resources Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-2">
          Workload Resources
        </span>
        {loading ? (
          <div className="text-xs text-zinc-500 italic pl-1">Loading workload resources...</div>
        ) : workloadResources.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No workload resources found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-55">
            <KubeTable<ResourceItem>
              columns={resourceColumns}
              data={workloadResources}
              getRowKey={(row) => row.id}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Other Resources Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-2">
          Other Resources
        </span>
        {loading ? (
          <div className="text-xs text-zinc-500 italic pl-1">Loading other resources...</div>
        ) : otherResources.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No other resources found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-65">
            <KubeTable<ResourceItem>
              columns={resourceColumns}
              data={otherResources}
              getRowKey={(row) => row.id}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};

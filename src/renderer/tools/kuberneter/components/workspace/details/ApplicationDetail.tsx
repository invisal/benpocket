import { MetricsSection } from './metrics';
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
          { kind: 'Pod', resource: 'pods' },
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

  const primaryPodName = useMemo(() => {
    const podItem = matchedResources.find((item) => item.kind === 'Pod');
    return podItem?.metadata?.name || '';
  }, [matchedResources]);

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
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Metrics
        </span>
        <MetricsSection
          namespace={payload.namespace}
          podName={primaryPodName}
          resourceLabel="application"
        />
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

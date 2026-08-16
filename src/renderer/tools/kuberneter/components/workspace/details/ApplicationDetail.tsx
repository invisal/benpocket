import { MetricsSection } from './metrics';
import { Age } from '../../Age';
import type React from 'react';
import { useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type ApplicationData } from '../../../types/ApplicationData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import type { Column } from '../../kubeTable';
import { type K8sResource } from '../../../types/K8sResource';
import {
  useOpenNamespaceDetail,
  useOpenServiceDetail,
  useOpenResourceDetail
} from '../../../hooks/open-detail';
import { cn } from 'cnfast';

interface ApplicationDetailProps {
  payload: ApplicationData;
  isTab?: boolean;
}

interface ResourceItem {
  id: string;
  name: string;
  kind: string;
  component: string;
  rawResource?: K8sResource;
}

export const ApplicationDetail: React.FC<ApplicationDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openServiceDetail } = useOpenServiceDetail();
  const { openResourceDetail } = useOpenResourceDetail();

  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const configPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const handleNamespaceClick = useCallback(
    (ns: string) => {
      if (ns) {
        openNamespaceDetail(ns);
      }
    },
    [openNamespaceDetail]
  );

  // Fetch and cache namespaced resources using React Query to prevent reload flicker on tab switches
  const { data: allRelatedResources = [], isLoading: loading } = useQuery<
    (K8sResource & { kind: string })[]
  >({
    queryKey: [
      'kuberneter',
      'application-resources',
      configPath,
      cluster,
      payload?.namespace,
      payload?.instance
    ],
    queryFn: async () => {
      const namespace = payload?.namespace;
      if (!cluster || !namespace) return [];

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
              namespace
            );
            const items = Array.isArray(res?.items) ? (res.items as K8sResource[]) : [];
            return items.map((item) => ({ ...item, kind }));
          } catch (err) {
            console.error(`Failed to fetch ${resource} in ApplicationDetail:`, err);
            return [];
          }
        })
      );

      return results.flat();
    },
    enabled: !!cluster && !!payload?.namespace && !!activeInstanceId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  // Match resources using application instance labels, Helm annotations, or names
  const matchedResources = useMemo(() => {
    const instance = payload?.instance;
    if (!instance) return [];

    return allRelatedResources.filter((item) => {
      const name = item.metadata?.name || '';
      const labels = item.metadata?.labels || {};
      const annotations = item.metadata?.annotations || {};

      // Match label selector keys
      if (
        labels['app.kubernetes.io/instance'] === instance ||
        labels['app.kubernetes.io/name'] === instance ||
        labels['app.kubernetes.io/part-of'] === instance ||
        labels['app'] === instance ||
        labels['release'] === instance
      ) {
        return true;
      }

      // Helm release annotation
      if (
        annotations['meta.helm.sh/release-name'] === instance ||
        labels['meta.helm.sh/release-name'] === instance
      ) {
        return true;
      }

      // Name matches instance or starts with instance name prefix plus dash
      if (name === instance || name.startsWith(`${instance}-`)) {
        return true;
      }

      return false;
    });
  }, [allRelatedResources, payload?.instance]);

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
        component: item.metadata?.labels?.['app.kubernetes.io/component'] || '',
        rawResource: item
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
        component: item.metadata?.labels?.['app.kubernetes.io/component'] || '',
        rawResource: item
      }));
  }, [matchedResources]);

  // Generate internal URLs block
  const internalUrls = useMemo(() => {
    const namespace = payload?.namespace;
    const services = otherResources.filter((r) => r.kind === 'Service');
    const urls: Array<{ url: string; serviceName?: string }> = [];
    services.forEach((svc) => {
      urls.push({ url: 'kubernetes.default.svc.cluster.local' });
      if (namespace) {
        urls.push({
          url: `${svc.name}.${namespace}.svc.cluster.local`,
          serviceName: svc.name
        });
      }
    });
    // Fallback if no services
    if (urls.length === 0) {
      urls.push({ url: 'kubernetes.default.svc.cluster.local' });
    }
    const seen = new Set<string>();
    return urls
      .filter((u) => {
        if (seen.has(u.url)) return false;
        seen.add(u.url);
        return true;
      })
      .slice(0, 8);
  }, [otherResources, payload?.namespace]);

  const resourceColumns = useMemo<Column<ResourceItem>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <span
            onClick={(e) => {
              e.stopPropagation();
              openResourceDetail(row.kind, payload?.namespace || '', row.name, row.rawResource);
            }}
            className="text-accent hover:underline cursor-pointer font-sans text-xs truncate block"
            title={row.name}
          >
            {row.name}
          </span>
        ),
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
    [openResourceDetail, payload?.namespace]
  );

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No application details available.</div>;
  }

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
          {internalUrls.map((urlObj, idx) => (
            <span
              key={idx}
              onClick={() => {
                if (urlObj.serviceName && payload?.namespace) {
                  openServiceDetail(payload.namespace, urlObj.serviceName);
                }
              }}
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-355 truncate w-fit select-all',
                urlObj.serviceName &&
                  'cursor-pointer hover:text-accent hover:underline hover:border-accent/40'
              )}
              title={urlObj.url}
            >
              {urlObj.url}
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
              onRowClick={(row) =>
                openResourceDetail(row.kind, payload?.namespace || '', row.name, row.rawResource)
              }
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
              onRowClick={(row) =>
                openResourceDetail(row.kind, payload?.namespace || '', row.name, row.rawResource)
              }
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

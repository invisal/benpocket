import { useState, useCallback, type FC } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  type DeployData,
  type DeployRevision,
  type DeployRelatedPod
} from '../../../../types/DeployData';
import { KubePropertiesTable, type PropertyItem } from '../KubePropertiesTable';
import { MetricsSection } from '../metrics';
import { Select } from '@renderer/components/ui/Select';
import { useInstantMetrics } from '../../../../hooks/useMetrics';
import {
  useOpenNamespaceDetail,
  useOpenPodDetail,
  useOpenNodeDetail,
  useOpenWorkloadDetail
} from '../../../../hooks/open-detail';
import { useLayoutStore } from '@renderer/store/layout.store';
import { useKuberneterStore } from '../../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../../constants/k8sResources';
import { type K8sResource } from '../../../../types/K8sResource';
import { formatAge } from '../../../../utils/formatAge';
import { Age } from '../../../Age';
import { WorkloadEnvironmentSection } from '../shared/WorkloadEnvironmentSection';
import { DeploymentRevisionsSection } from './DeploymentRevisionsSection';
import { DeploymentPodsSection } from './DeploymentPodsSection';

interface DeploymentDetailProps {
  payload: DeployData;
  isTab?: boolean;
}

interface DeployRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    replicas?: number;
    selector?: {
      matchLabels?: Record<string, string>;
    };
    strategy?: {
      type?: string;
    };
  };
  status?: {
    replicas?: number;
    updatedReplicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    unavailableReplicas?: number;
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export const DeploymentDetail: FC<DeploymentDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();
  const { openReplicaSetDetail } = useOpenWorkloadDetail();

  const [selectedTarget, setSelectedTarget] = useState<string>('all');

  const metricsQuery = useInstantMetrics(true);
  const metricItems = metricsQuery.data ?? [];

  // Fetch full deployment, replica sets, and pods with React Query caching
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'deployment-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const [deployRes, rsRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.DEPLOYMENTS,
          payload.ns
        ),
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.REPLICA_SETS,
          payload.ns
        ),
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.ns)
      ]);
      const deployItem = ((deployRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allRS = (rsRes?.items || []) as K8sResource[];
      const allPods = (podsRes?.items || []) as K8sResource[];

      // Match ReplicaSets owned by this Deployment
      const matchedRSList = allRS.filter((rs) => {
        const ownerRefs = rs.metadata?.ownerReferences || [];
        return (
          rs.metadata?.namespace === payload.ns &&
          ownerRefs.some((ref) => ref.kind === 'Deployment' && ref.name === payload.name)
        );
      });

      const revisions: DeployRevision[] = matchedRSList
        .map((rs) => {
          const revStr = rs.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '1';
          const revision = parseInt(revStr, 10) || 1;
          const rsReplicas = (rs.spec?.replicas as number) ?? 0;
          const rsReady = (rs.status?.readyReplicas as number) ?? 0;
          return {
            revision,
            name: rs.metadata?.name || '',
            podsCount: `${rsReady}/${rsReplicas}`,
            age: formatAge(rs.metadata?.creationTimestamp || ''),
            creationTimestamp: rs.metadata?.creationTimestamp || '',
            rawItem: rs
          } as DeployRevision & { rawItem?: K8sResource };
        })
        .sort((a, b) => b.revision - a.revision);

      const matchedRSNames = new Set(matchedRSList.map((rs) => rs.metadata?.name).filter(Boolean));
      const matchedPods = allPods.filter((pod) => {
        const ownerRefs = pod.metadata?.ownerReferences || [];
        return (
          pod.metadata?.namespace === payload.ns &&
          ownerRefs.some((ref) => ref.kind === 'ReplicaSet' && matchedRSNames.has(ref.name))
        );
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
        } as DeployRelatedPod & { rawItem?: K8sResource };
      });

      return {
        deployItem,
        revisions,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const ns = payload?.ns;
  const handleNamespaceClick = useCallback(() => {
    if (ns) {
      openNamespaceDetail(ns);
    }
  }, [ns, openNamespaceDetail]);

  if (!payload) {
    return <div className="p-4 text-sm text-zinc-500">No deployment details available.</div>;
  }

  const pods = queryData?.podsList || payload?.podsList || [];
  const revisions = queryData?.revisions || payload?.revisions || [];
  const rawItem = (queryData?.deployItem || payload.rawItem) as unknown as
    DeployRawResource | undefined;

  const allPodNames = pods.map((p) => p.name);
  const targetPodNames =
    selectedTarget === 'all'
      ? allPodNames
      : pods.some((p) => p.name === selectedTarget)
        ? [selectedTarget]
        : allPodNames;

  const labels = rawItem?.metadata?.labels ? Object.entries(rawItem.metadata.labels) : [];
  const annotations = rawItem?.metadata?.annotations
    ? Object.entries(rawItem.metadata.annotations)
    : [];
  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : payload.age || '';
  const selector = rawItem?.spec?.selector?.matchLabels
    ? Object.entries(rawItem.spec.selector.matchLabels)
    : [];
  const strategy = rawItem?.spec?.strategy?.type || payload.strategy || 'RollingUpdate';

  const readyReplicas =
    rawItem?.status?.readyReplicas ?? (parseInt(payload.ready?.split('/')?.[0], 10) || 0);
  const desiredReplicas = rawItem?.spec?.replicas ?? payload.replicas ?? 0;
  const updatedReplicas = rawItem?.status?.updatedReplicas ?? payload.upToDate ?? 0;

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age timestamp={(rawItem?.metadata?.creationTimestamp || payload.rawAge) as string} /> ago
          ({createdTime || 'N/A'})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer self-start"
        >
          {payload.ns}
        </span>
      )
    },
    {
      id: 'replicas',
      name: 'Replicas',
      value: `${readyReplicas} / ${desiredReplicas} ready (${updatedReplicas} updated)`
    },
    {
      id: 'strategy',
      name: 'Strategy',
      value: strategy
    },
    {
      id: 'selector',
      name: 'Selector',
      value: selector.length > 0 ? `${selector.length} Selectors` : '—',
      hasDetail: selector.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 select-text">
          {selector.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-300 break-all"
            >
              {k}: {v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'labels',
      name: 'Labels',
      value: labels.length > 0 ? `${labels.length} Labels` : '—',
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-300 break-all"
            >
              {k}: {v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: annotations.length > 0 ? `${annotations.length} Annotations` : '—',
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <div
              key={k}
              className="font-mono text-[10px] text-zinc-400 bg-editor-bg px-2 py-1 rounded border border-border-dark/60 truncate"
            >
              <span className="text-zinc-300 font-semibold">{k}:</span> {v}
            </div>
          ))}
        </div>
      )
    }
  ];

  // Derive condition states
  const conditions = rawItem?.status?.conditions || [];
  const availableCond = conditions.find((c) => c.type === 'Available');
  const progressingCond = conditions.find((c) => c.type === 'Progressing');

  const isAvailable = availableCond?.status === 'True';
  const isProgressing = progressingCond?.status === 'True';
  const isHealthy = isAvailable && readyReplicas === desiredReplicas && desiredReplicas > 0;

  return (
    <div
      className={`flex flex-col gap-4 text-sm font-sans select-text ${isTab ? 'p-6 max-w-7xl' : 'p-4'}`}
    >
      {/* Top Banner / Summary Card */}
      <div className="flex flex-col gap-3 p-3 bg-surface-2/60 border border-border/60 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${
                isHealthy
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                  : isProgressing
                    ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                    : 'bg-rose-500 shadow-sm shadow-rose-500/50'
              }`}
            />
            <span className="font-semibold text-foreground">{payload.name}</span>
            <span
              onClick={handleNamespaceClick}
              className="text-[11px] font-mono text-muted-foreground hover:text-accent cursor-pointer transition-colors"
            >
              [{payload.ns}]
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                isHealthy
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : isProgressing
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {isHealthy ? 'Healthy' : isProgressing ? 'Progressing' : 'Degraded'}
            </span>
            <span className="text-[11px] font-mono text-zinc-300">
              {readyReplicas}/{desiredReplicas} Pods Ready
            </span>
          </div>
        </div>

        {/* Conditions Summary Bar */}
        {conditions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40 text-[11px]">
            {conditions.map((c) => (
              <div
                key={c.type}
                className="flex items-center gap-1 text-[10px] bg-surface-3 px-2 py-0.5 rounded border border-border/40"
                title={c.message || c.reason}
              >
                <span className="text-zinc-400 font-medium">{c.type}:</span>
                <span
                  className={
                    c.status === 'True'
                      ? 'text-emerald-400 font-semibold'
                      : 'text-zinc-400 font-normal'
                  }
                >
                  {c.status}
                </span>
                {c.reason && <span className="text-zinc-500">({c.reason})</span>}
              </div>
            ))}
          </div>
        )}
      </div>

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
          namespace={payload.ns}
          podNames={targetPodNames}
          resourceLabel="deployment"
        />
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Environment Variables Section (Collapsible & Editable) */}
      <WorkloadEnvironmentSection
        resourceKind="Deployment"
        name={payload.name}
        namespace={payload.ns}
        rawItem={(queryData?.deployItem || payload.rawItem) as K8sResource | undefined}
      />

      {/* Deploy Revisions */}
      <DeploymentRevisionsSection
        revisions={revisions}
        namespace={payload.ns}
        onOpenReplicaSetDetail={openReplicaSetDetail}
      />

      {/* Pods Section */}
      <DeploymentPodsSection
        pods={pods}
        metricItems={metricItems}
        onOpenPodDetail={openPodDetail}
        onOpenNodeDetail={openNodeDetail}
        onNamespaceClick={handleNamespaceClick}
      />
    </div>
  );
};

import type React from 'react';
import { useWorkspaceResources } from './useWorkspaceResources';
import { ClusterOverview } from './cluster-overview/ClusterOverview';
import { Pods } from './pods/Pods';
import { Deployments } from './deployments/Deployments';
import { DaemonSets } from './daemonsets/DaemonSets';
import { StatefulSets } from './statefulsets/StatefulSets';
import { ReplicaSets } from './replicasets/ReplicaSets';
import { Jobs } from './jobs/Jobs';
import { CronJobs } from './cronjobs/CronJobs';
import { WorkloadOverview } from './workload-overview/WorkloadOverview';
import { ServicesTable } from './ServicesTable';
import { ConfigMaps } from './configmaps/ConfigMaps';
import { Secrets } from './secrets/Secrets';
import { ResourceQuotas } from './resourcequotas/ResourceQuotas';
import { LimitRanges } from './limitranges/LimitRanges';
import { HorizontalPodAutoscalers } from './hpas/HorizontalPodAutoscalers';
import { PodDisruptionBudgets } from './pdbs/PodDisruptionBudgets';
import { Application } from './application/Application';
import { Nodes } from './nodes/Nodes';
import { KuberneterHomeView } from './kubernetes-home';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { DetailContent } from './details/DetailContent';

export type { ApplicationData } from '../../types/ApplicationData';

interface KuberneterWorkspaceProps {
  resource: string;
}

export const KuberneterWorkspace: React.FC<KuberneterWorkspaceProps> = ({ resource }) => {
  const { openTabs, activeTabId } = useLayoutStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const {
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    podsData,
    deploysData,
    daemonSetsData,
    statefulSetsData,
    replicaSetsData,
    jobsData,
    cronJobsData,
    servicesData,
    configMapsData,
    secretsData,
    resourceQuotasData,
    limitRangesData,
    hpasData,
    pdbsData,
    applicationsData,
    nodesData,
    isLoading,
    errorMsg
  } = useWorkspaceResources(resource);

  // If we are not on the home connection view and there's no connected cluster
  if (resource !== 'home' && !kuberneterSelectedCluster) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 p-8 select-none">
        <AlertCircle className="size-10 text-zinc-650" />
        <p className="text-xs font-semibold text-zinc-400">Connection Required</p>
        <p className="text-[10px] text-zinc-500 text-center max-w-sm">
          No cluster context is currently connected. Please open the Kuberneter Home tab and connect
          to a cluster context first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 p-8 select-none">
          <Loader2 className="size-6 text-accent animate-spin" />
          <p className="text-[10px] text-zinc-500">Querying live Kubernetes cluster resources...</p>
        </div>
      )}

      {errorMsg && !isLoading && (
        <div className="shrink-0 flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-5">
          <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
          <div className="font-semibold break-all">
            <p>Error running kubectl command:</p>
            <p className="font-normal text-zinc-400 mt-1 font-mono text-[10px] bg-black/20 p-2 rounded border border-border-dark/30">
              {errorMsg}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !errorMsg && (
        <>
          {resource.endsWith('-detail') && activeTab && (
            <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-surface p-4 overflow-y-auto">
              <DetailContent
                contentType={resource.replace('-detail', '')}
                payload={(activeTab.meta as { payload?: unknown })?.payload}
                isTab
              />
            </div>
          )}

          {resource === 'home' && <KuberneterHomeView />}

          {resource === 'overview' && <ClusterOverview />}

          {resource === 'workloads-overview' && <WorkloadOverview />}

          {resource === 'pods' && (
            <Pods podsData={podsData} kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
          )}

          {resource === 'deployments' && (
            <Deployments
              deploysData={deploysData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'daemonsets' && (
            <DaemonSets
              daemonSetsData={daemonSetsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'statefulsets' && (
            <StatefulSets
              statefulSetsData={statefulSetsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'replicasets' && (
            <ReplicaSets
              replicaSetsData={replicaSetsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'jobs' && (
            <Jobs jobsData={jobsData} kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
          )}

          {resource === 'cronjobs' && (
            <CronJobs
              cronJobsData={cronJobsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'services' && (
            <ServicesTable
              servicesData={servicesData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'configmaps' && (
            <ConfigMaps
              configMapsData={configMapsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'secrets' && (
            <Secrets
              secretsData={secretsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'resourcequotas' && (
            <ResourceQuotas
              resourceQuotasData={resourceQuotasData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'limitranges' && (
            <LimitRanges
              limitRangesData={limitRangesData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'hpas' && (
            <HorizontalPodAutoscalers
              hpasData={hpasData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'pdbs' && (
            <PodDisruptionBudgets
              pdbsData={pdbsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'apps' && (
            <Application
              applicationsData={applicationsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'nodes' && <Nodes nodesData={nodesData} />}
        </>
      )}
    </div>
  );
};

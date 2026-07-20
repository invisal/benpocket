import type React from 'react';
import { useWorkspaceResources } from '../../hooks/useWorkspaceResources';
import { ClusterOverview } from './cluster-overview/ClusterOverview';
import { Pods } from './pods/Pods';
import { Deployments } from './deployments/Deployments';
import { DaemonSets } from './daemonsets/DaemonSets';
import { StatefulSets } from './statefulsets/StatefulSets';
import { ReplicaSets } from './replicasets/ReplicaSets';
import { Jobs } from './jobs/Jobs';
import { CronJobs } from './cronjobs/CronJobs';
import { WorkloadOverview } from './workload-overview/WorkloadOverview';
import { Services } from './services/Services';
import { PersistentVolumeClaims } from './pvcs/PersistentVolumeClaims';
import { PersistentVolumes } from './pvs/PersistentVolumes';
import { StorageClasses } from './storageclasses/StorageClasses';
import { Namespaces } from './namespaces/Namespaces';
import { Events } from './events/Events';
import { ConfigMaps } from './configmaps/ConfigMaps';
import { Secrets } from './secrets/Secrets';
import { ResourceQuotas } from './resourcequotas/ResourceQuotas';
import { LimitRanges } from './limitranges/LimitRanges';
import { HorizontalPodAutoscalers } from './hpas/HorizontalPodAutoscalers';
import { PodDisruptionBudgets } from './pdbs/PodDisruptionBudgets';
import { PriorityClasses } from './priorityclasses/PriorityClasses';
import { RuntimeClasses } from './runtimeclasses/RuntimeClasses';
import { Leases } from './leases/Leases';
import { MutatingWebhooks } from './mutatingwebhooks/MutatingWebhooks';
import { ValidatingWebhooks } from './validatingwebhooks/ValidatingWebhooks';
import { Application } from './application/Application';
import { Nodes } from './nodes/Nodes';
import { EndpointSlices } from './endpointslices/EndpointSlices';
import { Endpoints } from './endpoints/Endpoints';
import { Ingresses } from './ingresses/Ingresses';
import { IngressClasses } from './ingressclasses/IngressClasses';
import { NetworkPolicies } from './networkpolicies/NetworkPolicies';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { DetailContent } from './details/DetailContent';
import { HelmCharts } from './helm-charts/HelmCharts';

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
    priorityClassesData,
    runtimeClassesData,
    leasesData,
    mutatingWebhooksData,
    validatingWebhooksData,
    applicationsData,
    nodesData,
    endpointSlicesData,
    endpointsData,
    ingressesData,
    ingressClassesData,
    networkPoliciesData,
    pvcsData,
    pvsData,
    storageClassesData,
    namespacesData,
    eventsData,
    isLoading,
    errorMsg
  } = useWorkspaceResources(resource);

  // If there's no connected cluster
  if (!kuberneterSelectedCluster) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 p-8 select-none">
        <AlertCircle className="size-10 text-zinc-650" />
        <p className="text-xs font-semibold text-zinc-400">Connection Required</p>
        <p className="text-[10px] text-zinc-500 text-center max-w-sm">
          No cluster context is currently connected. Please connect to a cluster context first.
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
            <Services
              servicesData={servicesData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'pvcs' && (
            <PersistentVolumeClaims
              pvcsData={pvcsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'pvs' && <PersistentVolumes pvsData={pvsData} />}

          {resource === 'storageclasses' && (
            <StorageClasses storageClassesData={storageClassesData} />
          )}

          {resource === 'namespaces' && <Namespaces namespacesData={namespacesData} />}

          {resource === 'events' && <Events eventsData={eventsData} />}

          {resource === 'endpointslices' && (
            <EndpointSlices
              endpointSlicesData={endpointSlicesData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'endpoints' && (
            <Endpoints
              endpointsData={endpointsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'ingresses' && (
            <Ingresses
              ingressesData={ingressesData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'ingressclasses' && (
            <IngressClasses ingressClassesData={ingressClassesData} />
          )}

          {resource === 'networkpolicies' && (
            <NetworkPolicies
              networkPoliciesData={networkPoliciesData}
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

          {resource === 'priorityclasses' && (
            <PriorityClasses priorityClassesData={priorityClassesData} />
          )}

          {resource === 'runtimeclasses' && (
            <RuntimeClasses runtimeClassesData={runtimeClassesData} />
          )}

          {resource === 'leases' && (
            <Leases
              leasesData={leasesData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'mutatingwebhooks' && (
            <MutatingWebhooks mutatingWebhooksData={mutatingWebhooksData} />
          )}

          {resource === 'validatingwebhooks' && (
            <ValidatingWebhooks validatingWebhooksData={validatingWebhooksData} />
          )}

          {(resource === 'apps' || resource === 'helm-releases') && (
            <Application
              applicationsData={applicationsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'helm-charts' && <HelmCharts />}

          {resource === 'nodes' && <Nodes nodesData={nodesData} />}
        </>
      )}
    </div>
  );
};

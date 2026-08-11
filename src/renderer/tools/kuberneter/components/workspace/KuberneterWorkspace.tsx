import type React from 'react';
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
import { AlertCircle } from 'lucide-react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { DetailContent } from './details/DetailContent';
import { HelmCharts } from './helm-charts/HelmCharts';
import { HelmReleases } from './helm-releases/HelmReleases';
import { ServiceAccounts } from './serviceaccounts/ServiceAccounts';
import { ClusterRoles } from './clusterroles/ClusterRoles';
import { Roles } from './roles/Roles';
import { ClusterRoleBindings } from './clusterrolebindings/ClusterRoleBindings';
import { RoleBindings } from './rolebindings/RoleBindings';
import { PortForwarding } from './portforwarding/PortForwarding';
import { KuberneterSettings } from './settings/KuberneterSettings';
import { GenericKubeResourceView } from './GenericKubeResourceView';

export type { ApplicationData } from '../../types/ApplicationData';

interface KuberneterWorkspaceProps {
  resource: string;
}

export const KuberneterWorkspace: React.FC<KuberneterWorkspaceProps> = ({ resource }) => {
  const { openTabs, activeTabId } = useLayoutStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterSelectedCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const kuberneterSelectedNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );

  // Settings page works without a cluster connection
  if (resource === 'settings') {
    const section = (activeTab?.meta as { section?: string })?.section;
    return <KuberneterSettings section={section} />;
  }

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

      {resource === 'pods' && <Pods kuberneterSelectedNamespace={kuberneterSelectedNamespace} />}

      {resource === 'deployments' && (
        <Deployments kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'daemonsets' && (
        <DaemonSets kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'statefulsets' && (
        <StatefulSets kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'replicasets' && (
        <ReplicaSets kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'jobs' && <Jobs kuberneterSelectedNamespace={kuberneterSelectedNamespace} />}

      {resource === 'cronjobs' && (
        <CronJobs kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'services' && (
        <Services kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'pvcs' && (
        <PersistentVolumeClaims kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'pvs' && <PersistentVolumes />}

      {resource === 'storageclasses' && <StorageClasses />}

      {resource === 'namespaces' && <Namespaces />}

      {resource === 'events' && <Events />}

      {resource === 'endpointslices' && (
        <EndpointSlices kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'endpoints' && (
        <Endpoints kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'ingresses' && (
        <Ingresses kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'ingressclasses' && <IngressClasses />}

      {resource === 'networkpolicies' && (
        <NetworkPolicies kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'configmaps' && (
        <ConfigMaps kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'secrets' && (
        <Secrets kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'resourcequotas' && (
        <ResourceQuotas kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'limitranges' && (
        <LimitRanges kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'hpas' && (
        <HorizontalPodAutoscalers kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'pdbs' && (
        <PodDisruptionBudgets kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'priorityclasses' && <PriorityClasses />}

      {resource === 'runtimeclasses' && <RuntimeClasses />}

      {resource === 'leases' && (
        <Leases kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'mutatingwebhooks' && <MutatingWebhooks />}

      {resource === 'validatingwebhooks' && <ValidatingWebhooks />}

      {resource === 'apps' && (
        <Application kuberneterSelectedNamespace={kuberneterSelectedNamespace} />
      )}

      {resource === 'helm-charts' && <HelmCharts />}

      {resource === 'helm-releases' && <HelmReleases />}

      {resource === 'serviceaccounts' && <ServiceAccounts />}

      {resource === 'clusterroles' && <ClusterRoles />}

      {resource === 'roles' && <Roles />}

      {resource === 'clusterrolebindings' && <ClusterRoleBindings />}

      {resource === 'bindings' && <RoleBindings />}

      {resource === 'nodes' && <Nodes />}

      {resource === 'portforwarding' && <PortForwarding />}

      {resource.startsWith('crd--') && (
        <GenericKubeResourceView
          resource={resource}
          kuberneterSelectedNamespace={kuberneterSelectedNamespace}
        />
      )}
    </div>
  );
};

import React from 'react';
import { useWorkspaceResources } from './useWorkspaceResources';
import { ClusterOverview } from './cluster-overview/ClusterOverview';
import { PodsTable } from './PodsTable';
import { DeploymentsTable } from './DeploymentsTable';
import { ServicesTable } from './ServicesTable';
import { ConfigMapsTable } from './ConfigMapsTable';
import { Application } from './application/Application';
import { KuberneterHomeView } from './kubernetes-home';
import { AlertCircle, Loader2 } from 'lucide-react';

export type { ApplicationData } from '../../types/ApplicationData';

interface KuberneterWorkspaceProps {
  resource: string;
}

export const KuberneterWorkspace: React.FC<KuberneterWorkspaceProps> = ({ resource }) => {
  const {
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    podsData,
    deploysData,
    servicesData,
    configMapsData,
    applicationsData,
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
    <div className="flex-1 flex flex-col gap-4 min-h-0">
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
          {resource === 'home' && <KuberneterHomeView />}

          {resource === 'overview' && <ClusterOverview />}

          {resource === 'pods' && (
            <PodsTable
              podsData={podsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'deployments' && (
            <DeploymentsTable
              deploysData={deploysData}
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
            <ConfigMapsTable
              configMapsData={configMapsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}

          {resource === 'apps' && (
            <Application
              applicationsData={applicationsData}
              kuberneterSelectedNamespace={kuberneterSelectedNamespace}
            />
          )}
        </>
      )}
    </div>
  );
};

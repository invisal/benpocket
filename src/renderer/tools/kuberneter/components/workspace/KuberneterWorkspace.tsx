import React, { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { ClusterOverview } from './ClusterOverview';
import { PodsTable } from './PodsTable';
import { DeploymentsTable } from './DeploymentsTable';
import { ServicesTable } from './ServicesTable';
import { ConfigMapsTable } from './ConfigMapsTable';
import { KuberneterHomeView } from './kubernetes-home';
import { AlertCircle, Loader2 } from 'lucide-react';

interface KuberneterWorkspaceProps {
  resource: string;
}

function formatAge(creationTimestamp: string): string {
  if (!creationTimestamp) return '-';
  const created = new Date(creationTimestamp).getTime();
  const diff = Date.now() - created;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}m`;
  return 'just now';
}

export const KuberneterWorkspace: React.FC<KuberneterWorkspaceProps> = ({ resource }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterSelectedCluster = useLayoutStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const kuberneterSelectedNamespace = useLayoutStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );
  const activeConfigPath = useLayoutStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  // States for dynamic resources
  const [podsData, setPodsData] = useState<any[]>([]);
  const [deploysData, setDeploysData] = useState<any[]>([]);
  const [servicesData, setServicesData] = useState<any[]>([]);
  const [configMapsData, setConfigMapsData] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchResources = async () => {
    if (resource === 'home' || !kuberneterSelectedCluster) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;

      // Determine what resources to query
      let queryResource = '';
      if (resource === 'pods') queryResource = 'pods';
      else if (resource === 'deployments') queryResource = 'deployments';
      else if (resource === 'services') queryResource = 'services';
      else if (resource === 'configmaps') queryResource = 'configmaps';
      else return; // Don't fetch if overview/other not supported yet

      const res = await window.kuberneter.getResources(
        configPathArg,
        kuberneterSelectedCluster,
        queryResource,
        kuberneterSelectedNamespace
      );

      if (res && res.error) {
        setErrorMsg(res.error);
        return;
      }

      const items = res.items || [];

      // Transform data to fit the table props
      if (resource === 'pods') {
        const transformed = items.map((item: any) => {
          const containerStatuses = item.status?.containerStatuses || [];
          const restarts = containerStatuses.reduce(
            (acc: number, c: any) => acc + (c.restartCount || 0),
            0
          );
          return {
            name: item.metadata?.name || '',
            ns: item.metadata?.namespace || '',
            status: item.status?.phase || 'Unknown',
            restarts,
            age: formatAge(item.metadata?.creationTimestamp)
          };
        });
        setPodsData(transformed);
      } else if (resource === 'deployments') {
        const transformed = items.map((item: any) => {
          const replicas = item.status?.replicas || 0;
          const readyReplicas = item.status?.readyReplicas || 0;
          return {
            name: item.metadata?.name || '',
            ns: item.metadata?.namespace || '',
            ready: `${readyReplicas}/${replicas}`,
            upToDate: item.status?.updatedReplicas || 0,
            available: item.status?.availableReplicas || 0,
            age: formatAge(item.metadata?.creationTimestamp)
          };
        });
        setDeploysData(transformed);
      } else if (resource === 'services') {
        const transformed = items.map((item: any) => {
          const ports =
            item.spec?.ports?.map((p: any) => `${p.port}/${p.protocol}`).join(', ') || '';
          return {
            name: item.metadata?.name || '',
            ns: item.metadata?.namespace || '',
            type: item.spec?.type || 'ClusterIP',
            clusterIp: item.spec?.clusterIP || '',
            ports,
            age: formatAge(item.metadata?.creationTimestamp)
          };
        });
        setServicesData(transformed);
      } else if (resource === 'configmaps') {
        const transformed = items.map((item: any) => {
          const keys = Object.keys(item.data || {}).length;
          return {
            name: item.metadata?.name || '',
            ns: item.metadata?.namespace || '',
            keys,
            age: formatAge(item.metadata?.creationTimestamp)
          };
        });
        setConfigMapsData(transformed);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch cluster resources.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [resource, kuberneterSelectedCluster, kuberneterSelectedNamespace, activeConfigPath]);

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
        </>
      )}
    </div>
  );
};

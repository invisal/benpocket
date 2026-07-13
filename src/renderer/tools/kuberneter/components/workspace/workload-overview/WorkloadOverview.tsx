import React from 'react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { useWorkloadOverview } from './useWorkloadOverview';
import { WorkloadSummaryCards } from './WorkloadSummaryCards';
import { WorkloadEventsFeed } from './WorkloadEventsFeed';
import { AlertCircle, Loader2, RefreshCw, LayoutDashboard } from 'lucide-react';

export const WorkloadOverview: React.FC = () => {
  const { activeInstanceId, openTab } = useLayoutStore();
  const { kuberneterInstanceNamespace, setKuberneterInstanceResource } = useKuberneterStore();

  const ns = kuberneterInstanceNamespace?.[activeInstanceId] || 'All Namespaces';

  const {
    podsData,
    deploysData,
    daemonSetsData,
    statefulSetsData,
    replicaSetsData,
    jobsData,
    cronJobsData,
    eventsData,
    isLoading,
    errorMsg,
    refresh
  } = useWorkloadOverview();

  const navigateTo = (resource: string) => {
    const labelMap: Record<string, string> = {
      pods: 'Pods',
      deployments: 'Deployments',
      daemonsets: 'Daemon Sets',
      statefulsets: 'Stateful Sets',
      replicasets: 'Replica Sets',
      jobs: 'Jobs',
      cronjobs: 'Cron Jobs'
    };
    setKuberneterInstanceResource(activeInstanceId, resource);
    openTab({
      id: `kuberneter-k8s-${resource}-${activeInstanceId}`,
      title: `K8s ${labelMap[resource] || resource}`,
      type: 'kuberneter',
      instanceId: activeInstanceId,
      meta: { resource }
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 p-8 select-none">
        <Loader2 className="size-6 text-accent animate-spin" />
        <p className="text-[10px] text-zinc-500">Loading workloads overview...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex-1 flex flex-col gap-4 p-6">
        <div className="flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-5">
          <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
          <div className="font-semibold break-all">
            <p>Error loading workloads:</p>
            <p className="font-normal text-zinc-400 mt-1 font-mono text-[10px] bg-black/20 p-2 rounded border border-border-dark/30">
              {errorMsg}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-5 min-h-0 min-w-0 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-4 text-accent" />
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">Workloads Overview</h2>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {ns === 'All Namespaces' ? 'All Namespaces' : `Namespace: ${ns}`}
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium bg-surface-2 border border-border-dark/60 text-zinc-500 hover:text-zinc-300 hover:border-border-dark transition-all cursor-pointer"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="shrink-0">
        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-2">
          Resource Summary
        </div>
        <WorkloadSummaryCards
          podsData={podsData}
          deploysData={deploysData}
          daemonSetsData={daemonSetsData}
          statefulSetsData={statefulSetsData}
          replicaSetsData={replicaSetsData}
          jobsData={jobsData}
          cronJobsData={cronJobsData}
          onNavigate={navigateTo}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-border-dark/40 shrink-0" />

      {/* Events Feed */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider shrink-0">
          Kubernetes Events
        </div>
        <WorkloadEventsFeed eventsData={eventsData} kuberneterSelectedNamespace={ns} />
      </div>
    </div>
  );
};

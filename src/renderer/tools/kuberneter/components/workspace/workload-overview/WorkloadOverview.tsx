import React from 'react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { useWorkloadOverview } from './useWorkloadOverview';
import { WorkloadSummaryCards } from './WorkloadSummaryCards';
import { WorkloadEventsFeed } from './WorkloadEventsFeed';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { cn } from 'cnfast';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

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
    <KubeWorkspaceLayout
      header={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-bold text-text-base uppercase tracking-wider font-sans">
            Workloads Overview
          </span>
          <Button onClick={refresh} variant="outline" size="sm" className="gap-1.5 h-7 text-[10px]">
            <RefreshCw className={cn('size-3 text-accent')} />
            <span>Sync</span>
          </Button>
        </div>
      }
    >
      {/* Scrollable content — flex-1 so it fills remaining height with no trailing gap */}
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden min-h-0">
        {/* Resource Summary */}
        <div className="shrink-0 px-4 mb-5">
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

        {/* Events Feed — shrink-0 so it takes only its content height; outer container scrolls */}
        <div className="flex flex-col shrink-0">
          <div className="px-4 shrink-0 mb-2">
            <span className="text-xs font-bold text-text-base uppercase tracking-wider font-sans pb-1.5 border-b border-border/40 truncate shrink-0 block">
              Kubernetes Events
            </span>
          </div>
          <WorkloadEventsFeed eventsData={eventsData} kuberneterSelectedNamespace={ns} />
        </div>
      </div>
    </KubeWorkspaceLayout>
  );
};

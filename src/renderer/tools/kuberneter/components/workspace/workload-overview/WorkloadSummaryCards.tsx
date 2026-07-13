import type React from 'react';
import {
  Layers2,
  Cpu,
  Server,
  RefreshCw,
  Copy,
  Briefcase,
  Clock4,
  AlertTriangle
} from 'lucide-react';
import { type PodData } from '../../../types/PodData';
import { type DeployData } from '../../../types/DeployData';
import { type DaemonSetData } from '../../../types/DaemonSetData';
import { type StatefulSetData } from '../../../types/StatefulSetData';
import { type ReplicaSetData } from '../../../types/ReplicaSetData';
import { type JobData } from '../../../types/JobData';
import { type CronJobData } from '../../../types/CronJobData';

interface WorkloadCard {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  total: number;
  healthy: number;
  warning: number;
  failed: number;
  subtitle: string; // e.g. "62 ready" or "3 succeeded"
}

interface WorkloadSummaryCardsProps {
  podsData: PodData[];
  deploysData: DeployData[];
  daemonSetsData: DaemonSetData[];
  statefulSetsData: StatefulSetData[];
  replicaSetsData: ReplicaSetData[];
  jobsData: JobData[];
  cronJobsData: CronJobData[];
  onNavigate: (resource: string) => void;
}

function buildCards(props: WorkloadSummaryCardsProps): WorkloadCard[] {
  const {
    podsData,
    deploysData,
    daemonSetsData,
    statefulSetsData,
    replicaSetsData,
    jobsData,
    cronJobsData
  } = props;

  // Pods
  const runningPods = podsData.filter((p) => p.status === 'Running').length;
  const pendingPods = podsData.filter((p) => p.status === 'Pending').length;
  const failedPods = podsData.filter(
    (p) => p.status !== 'Running' && p.status !== 'Succeeded' && p.status !== 'Pending'
  ).length;

  // Deployments
  const healthyDeploys = deploysData.filter((d) => !d.hasWarning).length;
  const warningDeploys = deploysData.filter((d) => d.hasWarning).length;

  // DaemonSets
  const healthyDs = daemonSetsData.filter((d) => !d.hasWarning).length;
  const warningDs = daemonSetsData.filter((d) => d.hasWarning).length;

  // StatefulSets
  const healthySs = statefulSetsData.filter((s) => !s.hasWarning).length;
  const warningSs = statefulSetsData.filter((s) => s.hasWarning).length;

  // ReplicaSets
  const healthyRs = replicaSetsData.filter((r) => !r.hasWarning).length;
  const warningRs = replicaSetsData.filter((r) => r.hasWarning).length;

  // Jobs
  const succeededJobs = jobsData.filter(
    (j) =>
      j.conditions.toLowerCase().includes('complete') ||
      j.conditions.toLowerCase().includes('success')
  ).length;
  const failedJobs = jobsData.filter((j) => j.hasWarning).length;
  const runningJobs = jobsData.length - succeededJobs - failedJobs;

  // CronJobs
  const activeCjs = cronJobsData.filter((c) => c.active > 0).length;
  const suspendedCjs = cronJobsData.filter((c) => c.suspend).length;
  const healthyCjs = cronJobsData.length - suspendedCjs;

  return [
    {
      id: 'pods',
      label: 'Pods',
      icon: Cpu,
      total: podsData.length,
      healthy: runningPods,
      warning: pendingPods,
      failed: failedPods,
      subtitle: `${runningPods} running`
    },
    {
      id: 'deployments',
      label: 'Deployments',
      icon: Layers2,
      total: deploysData.length,
      healthy: healthyDeploys,
      warning: warningDeploys,
      failed: 0,
      subtitle: `${healthyDeploys} ready`
    },
    {
      id: 'daemonsets',
      label: 'Daemon Sets',
      icon: Server,
      total: daemonSetsData.length,
      healthy: healthyDs,
      warning: warningDs,
      failed: 0,
      subtitle: `${healthyDs} healthy`
    },
    {
      id: 'statefulsets',
      label: 'Stateful Sets',
      icon: RefreshCw,
      total: statefulSetsData.length,
      healthy: healthySs,
      warning: warningSs,
      failed: 0,
      subtitle: `${healthySs} ready`
    },
    {
      id: 'replicasets',
      label: 'Replica Sets',
      icon: Copy,
      total: replicaSetsData.length,
      healthy: healthyRs,
      warning: warningRs,
      failed: 0,
      subtitle: `${healthyRs} healthy`
    },
    {
      id: 'jobs',
      label: 'Jobs',
      icon: Briefcase,
      total: jobsData.length,
      healthy: succeededJobs,
      warning: runningJobs,
      failed: failedJobs,
      subtitle: `${succeededJobs} complete`
    },
    {
      id: 'cronjobs',
      label: 'Cron Jobs',
      icon: Clock4,
      total: cronJobsData.length,
      healthy: healthyCjs,
      warning: activeCjs,
      failed: suspendedCjs,
      subtitle: `${activeCjs} active`
    }
  ];
}

export const WorkloadSummaryCards: React.FC<WorkloadSummaryCardsProps> = (props) => {
  const { onNavigate } = props;
  const cards = buildCards(props);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-0 divide-x divide-border/40">
      {cards.map((card) => {
        const Icon = card.icon;
        const hasAnyIssues = card.warning > 0 || card.failed > 0;
        const healthyPct = card.total > 0 ? (card.healthy / card.total) * 100 : 0;
        const warningPct = card.total > 0 ? (card.warning / card.total) * 100 : 0;
        const failedPct = card.total > 0 ? (card.failed / card.total) * 100 : 0;

        return (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            className="group flex flex-col gap-2.5 p-3 hover:bg-surface-2/60 transition-all duration-200 cursor-pointer text-left first:rounded-l-lg last:rounded-r-lg"
          >
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon className="size-3.5 text-zinc-500 group-hover:text-accent transition-colors" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-400 transition-colors">
                  {card.label}
                </span>
              </div>
              {hasAnyIssues && <AlertTriangle className="size-3 text-amber-500/80 shrink-0" />}
            </div>

            {/* Count */}
            <div className="flex items-end gap-1.5">
              <span className="text-2xl font-bold text-white leading-none">{card.total}</span>
              <span className="text-[10px] text-zinc-600 pb-0.5">{card.subtitle}</span>
            </div>

            {/* Health bar */}
            <div className="h-1.5 w-full rounded-full bg-surface-4 overflow-hidden flex">
              {card.total === 0 ? (
                <div className="h-full w-full bg-zinc-700/50 rounded-full" />
              ) : (
                <>
                  {/* Healthy – green */}
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${healthyPct}%` }}
                  />
                  {/* Warning – amber */}
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${warningPct}%` }}
                  />
                  {/* Failed – red */}
                  <div
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${failedPct}%` }}
                  />
                </>
              )}
            </div>

            {/* Legend */}
            {card.total > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-[9px] text-emerald-500/80">
                  <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                  {card.healthy}
                </span>
                {card.warning > 0 && (
                  <span className="flex items-center gap-1 text-[9px] text-amber-500/80">
                    <span className="size-1.5 rounded-full bg-amber-500 inline-block" />
                    {card.warning}
                  </span>
                )}
                {card.failed > 0 && (
                  <span className="flex items-center gap-1 text-[9px] text-red-500/80">
                    <span className="size-1.5 rounded-full bg-red-500 inline-block" />
                    {card.failed}
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

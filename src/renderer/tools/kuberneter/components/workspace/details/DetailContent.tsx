import type React from 'react';
import { PodDetail } from './PodDetail';
import { DeploymentDetail } from './DeploymentDetail';
import { DaemonSetDetail } from './DaemonSetDetail';
import { StatefulSetDetail } from './StatefulSetDetail';
import { ReplicaSetDetail } from './ReplicaSetDetail';
import { JobDetail } from './JobDetail';
import { CronJobDetail } from './CronJobDetail';
import { ConfigMapDetail } from './ConfigMapDetail';
import { SecretDetail } from './SecretDetail';
import { ResourceQuotaDetail } from './ResourceQuotaDetail';
import { LimitRangeDetail } from './LimitRangeDetail';
import { HorizontalPodAutoscalerDetail } from './HorizontalPodAutoscalerDetail';
import { PodDisruptionBudgetDetail } from './PodDisruptionBudgetDetail';
import { PriorityClassDetail } from './PriorityClassDetail';
import { RuntimeClassDetail } from './RuntimeClassDetail';
import { LeaseDetail } from './LeaseDetail';
import { MutatingWebhookDetail } from './MutatingWebhookDetail';

import { type PodData } from '../../../types/PodData';
import { type DeployData } from '../../../types/DeployData';
import { type DaemonSetData } from '../../../types/DaemonSetData';
import { type StatefulSetData } from '../../../types/StatefulSetData';
import { type ReplicaSetData } from '../../../types/ReplicaSetData';
import { type JobData } from '../../../types/JobData';
import { type CronJobData } from '../../../types/CronJobData';
import { type ConfigMapData } from '../../../types/ConfigMapData';
import { type SecretData } from '../../../types/SecretData';
import { type ResourceQuotaData } from '../../../types/ResourceQuotaData';
import { type LimitRangeData } from '../../../types/LimitRangeData';
import { type HorizontalPodAutoscalerData } from '../../../types/HorizontalPodAutoscalerData';
import { type PodDisruptionBudgetData } from '../../../types/PodDisruptionBudgetData';
import { type PriorityClassData } from '../../../types/PriorityClassData';
import { type RuntimeClassData } from '../../../types/RuntimeClassData';
import { type LeaseData } from '../../../types/LeaseData';
import { type MutatingWebhookConfigurationData } from '../../../types/MutatingWebhookConfigurationData';

interface DetailContentProps {
  contentType: string;
  payload: unknown;
  isTab?: boolean;
}

export const DetailContent: React.FC<DetailContentProps> = ({
  contentType,
  payload,
  isTab = false
}) => {
  switch (contentType) {
    case 'pod':
      return <PodDetail payload={payload as PodData} isTab={isTab} />;
    case 'deployment':
      return <DeploymentDetail payload={payload as DeployData} isTab={isTab} />;
    case 'daemonset':
      return <DaemonSetDetail payload={payload as DaemonSetData} isTab={isTab} />;
    case 'statefulset':
      return <StatefulSetDetail payload={payload as StatefulSetData} isTab={isTab} />;
    case 'replicaset':
      return <ReplicaSetDetail payload={payload as ReplicaSetData} isTab={isTab} />;
    case 'job':
      return <JobDetail payload={payload as JobData} isTab={isTab} />;
    case 'cronjob':
      return <CronJobDetail payload={payload as CronJobData} isTab={isTab} />;
    case 'configmap':
      return <ConfigMapDetail payload={payload as ConfigMapData} isTab={isTab} />;
    case 'secret':
      return <SecretDetail payload={payload as SecretData} isTab={isTab} />;
    case 'resourcequota':
      return <ResourceQuotaDetail payload={payload as ResourceQuotaData} isTab={isTab} />;
    case 'limitrange':
      return <LimitRangeDetail payload={payload as LimitRangeData} isTab={isTab} />;
    case 'horizontalpodautoscaler':
      return (
        <HorizontalPodAutoscalerDetail
          payload={payload as HorizontalPodAutoscalerData}
          isTab={isTab}
        />
      );
    case 'poddisruptionbudget':
      return (
        <PodDisruptionBudgetDetail payload={payload as PodDisruptionBudgetData} isTab={isTab} />
      );
    case 'priorityclass':
      return <PriorityClassDetail payload={payload as PriorityClassData} isTab={isTab} />;
    case 'runtimeclass':
      return <RuntimeClassDetail payload={payload as RuntimeClassData} isTab={isTab} />;
    case 'lease':
      return <LeaseDetail payload={payload as LeaseData} isTab={isTab} />;
    case 'mutatingwebhook':
      return (
        <MutatingWebhookDetail
          payload={payload as MutatingWebhookConfigurationData}
          isTab={isTab}
        />
      );
    default:
      return (
        <div className="p-4 text-xs text-zinc-500">
          No detail view implemented for type: {contentType}
        </div>
      );
  }
};

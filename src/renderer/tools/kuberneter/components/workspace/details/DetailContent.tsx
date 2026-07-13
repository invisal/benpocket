import type React from 'react';
import { PodDetail } from './PodDetail';
import { DeploymentDetail } from './DeploymentDetail';
import { DaemonSetDetail } from './DaemonSetDetail';
import { StatefulSetDetail } from './StatefulSetDetail';
import { ReplicaSetDetail } from './ReplicaSetDetail';
import { JobDetail } from './JobDetail';
import { CronJobDetail } from './CronJobDetail';

import { type PodData } from '../../../types/PodData';
import { type DeployData } from '../../../types/DeployData';
import { type DaemonSetData } from '../../../types/DaemonSetData';
import { type StatefulSetData } from '../../../types/StatefulSetData';
import { type ReplicaSetData } from '../../../types/ReplicaSetData';
import { type JobData } from '../../../types/JobData';
import { type CronJobData } from '../../../types/CronJobData';

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
    default:
      return (
        <div className="p-4 text-xs text-zinc-500">
          No detail view implemented for type: {contentType}
        </div>
      );
  }
};

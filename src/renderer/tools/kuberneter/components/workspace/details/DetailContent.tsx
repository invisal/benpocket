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
import { ServiceDetail } from './ServiceDetail';
import { PersistentVolumeClaimDetail } from './PersistentVolumeClaimDetail';
import { PersistentVolumeDetail } from './PersistentVolumeDetail';
import { StorageClassDetail } from './StorageClassDetail';
import { MutatingWebhookDetail } from './MutatingWebhookDetail';
import { type PersistentVolumeClaimData } from '../../../types/PersistentVolumeClaimData';
import { type PersistentVolumeData } from '../../../types/PersistentVolumeData';
import { type StorageClassData } from '../../../types/StorageClassData';

import { ValidatingWebhookDetail } from './ValidatingWebhookDetail';
import { EndpointSliceDetail } from './EndpointSliceDetail';
import { EndpointDetail } from './EndpointDetail';
import { IngressDetail } from './IngressDetail';
import { IngressClassDetail } from './IngressClassDetail';
import { NetworkPolicyDetail } from './NetworkPolicyDetail';

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
import { type ServiceData } from '../../../types/ServiceData';
import { type MutatingWebhookConfigurationData } from '../../../types/MutatingWebhookConfigurationData';
import { type ValidatingWebhookConfigurationData } from '../../../types/ValidatingWebhookConfigurationData';
import { type EndpointSliceData } from '../../../types/EndpointSliceData';
import { type EndpointData } from '../../../types/EndpointData';
import { type IngressData } from '../../../types/IngressData';
import { type IngressClassData } from '../../../types/IngressClassData';
import { type NetworkPolicyData } from '../../../types/NetworkPolicyData';

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
    case 'service':
      return <ServiceDetail payload={payload as ServiceData} isTab={isTab} />;
    case 'persistentvolumeclaim':
      return (
        <PersistentVolumeClaimDetail payload={payload as PersistentVolumeClaimData} isTab={isTab} />
      );
    case 'persistentvolume':
      return <PersistentVolumeDetail payload={payload as PersistentVolumeData} isTab={isTab} />;
    case 'storageclass':
      return <StorageClassDetail payload={payload as StorageClassData} isTab={isTab} />;
    case 'endpointslice':
      return <EndpointSliceDetail payload={payload as EndpointSliceData} isTab={isTab} />;
    case 'endpoints':
      return <EndpointDetail payload={payload as EndpointData} isTab={isTab} />;
    case 'ingresses':
      return <IngressDetail payload={payload as IngressData} isTab={isTab} />;
    case 'ingressclasses':
      return <IngressClassDetail payload={payload as IngressClassData} isTab={isTab} />;
    case 'networkpolicies':
      return <NetworkPolicyDetail payload={payload as NetworkPolicyData} isTab={isTab} />;
    case 'mutatingwebhook':
      return (
        <MutatingWebhookDetail
          payload={payload as MutatingWebhookConfigurationData}
          isTab={isTab}
        />
      );
    case 'validatingwebhook':
      return (
        <ValidatingWebhookDetail
          payload={payload as ValidatingWebhookConfigurationData}
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

import { deploymentTemplate } from './deployment';
import { podTemplate } from './pod';
import { serviceTemplate } from './service';
import { configMapTemplate } from './configMap';
import { secretTemplate } from './secret';
import { statefulSetTemplate } from './statefulSet';
import { daemonSetTemplate } from './daemonSet';
import { replicaSetTemplate } from './replicaSet';
import { jobTemplate } from './job';
import { cronJobTemplate } from './cronJob';
import { ingressTemplate } from './ingress';
import { ingressClassTemplate } from './ingressClass';
import { networkPolicyTemplate } from './networkPolicy';
import { persistentVolumeClaimTemplate } from './persistentVolumeClaim';
import { persistentVolumeTemplate } from './persistentVolume';
import { storageClassTemplate } from './storageClass';
import { serviceAccountTemplate } from './serviceAccount';
import { roleTemplate } from './role';
import { roleBindingTemplate } from './roleBinding';
import { clusterRoleTemplate } from './clusterRole';
import { clusterRoleBindingTemplate } from './clusterRoleBinding';
import { horizontalPodAutoscalerTemplate } from './horizontalPodAutoscaler';
import { podDisruptionBudgetTemplate } from './podDisruptionBudget';
import { resourceQuotaTemplate } from './resourceQuota';
import { limitRangeTemplate } from './limitRange';
import { namespaceTemplate } from './namespace';
import { priorityClassTemplate } from './priorityClass';
import { runtimeClassTemplate } from './runtimeClass';
import { leaseTemplate } from './lease';
import { mutatingWebhookConfigurationTemplate } from './mutatingWebhookConfiguration';
import { validatingWebhookConfigurationTemplate } from './validatingWebhookConfiguration';

export {
  deploymentTemplate,
  podTemplate,
  serviceTemplate,
  configMapTemplate,
  secretTemplate,
  statefulSetTemplate,
  daemonSetTemplate,
  replicaSetTemplate,
  jobTemplate,
  cronJobTemplate,
  ingressTemplate,
  ingressClassTemplate,
  networkPolicyTemplate,
  persistentVolumeClaimTemplate,
  persistentVolumeTemplate,
  storageClassTemplate,
  serviceAccountTemplate,
  roleTemplate,
  roleBindingTemplate,
  clusterRoleTemplate,
  clusterRoleBindingTemplate,
  horizontalPodAutoscalerTemplate,
  podDisruptionBudgetTemplate,
  resourceQuotaTemplate,
  limitRangeTemplate,
  namespaceTemplate,
  priorityClassTemplate,
  runtimeClassTemplate,
  leaseTemplate,
  mutatingWebhookConfigurationTemplate,
  validatingWebhookConfigurationTemplate
};

export interface TemplateCategory {
  name: string;
  templates: { name: string; content: string }[];
}

export const RESOURCE_TEMPLATES: Record<string, string> = {
  Deployment: deploymentTemplate,
  Pod: podTemplate,
  Service: serviceTemplate,
  ConfigMap: configMapTemplate,
  Secret: secretTemplate,
  StatefulSet: statefulSetTemplate,
  DaemonSet: daemonSetTemplate,
  ReplicaSet: replicaSetTemplate,
  Job: jobTemplate,
  CronJob: cronJobTemplate,
  Ingress: ingressTemplate,
  IngressClass: ingressClassTemplate,
  NetworkPolicy: networkPolicyTemplate,
  PersistentVolumeClaim: persistentVolumeClaimTemplate,
  PersistentVolume: persistentVolumeTemplate,
  StorageClass: storageClassTemplate,
  ServiceAccount: serviceAccountTemplate,
  Role: roleTemplate,
  RoleBinding: roleBindingTemplate,
  ClusterRole: clusterRoleTemplate,
  ClusterRoleBinding: clusterRoleBindingTemplate,
  HorizontalPodAutoscaler: horizontalPodAutoscalerTemplate,
  PodDisruptionBudget: podDisruptionBudgetTemplate,
  ResourceQuota: resourceQuotaTemplate,
  LimitRange: limitRangeTemplate,
  Namespace: namespaceTemplate,
  PriorityClass: priorityClassTemplate,
  RuntimeClass: runtimeClassTemplate,
  Lease: leaseTemplate,
  MutatingWebhookConfiguration: mutatingWebhookConfigurationTemplate,
  ValidatingWebhookConfiguration: validatingWebhookConfigurationTemplate
};

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    name: 'Workloads',
    templates: [
      { name: 'Deployment', content: deploymentTemplate },
      { name: 'Pod', content: podTemplate },
      { name: 'StatefulSet', content: statefulSetTemplate },
      { name: 'DaemonSet', content: daemonSetTemplate },
      { name: 'ReplicaSet', content: replicaSetTemplate },
      { name: 'Job', content: jobTemplate },
      { name: 'CronJob', content: cronJobTemplate }
    ]
  },
  {
    name: 'Networking',
    templates: [
      { name: 'Service', content: serviceTemplate },
      { name: 'Ingress', content: ingressTemplate },
      { name: 'IngressClass', content: ingressClassTemplate },
      { name: 'NetworkPolicy', content: networkPolicyTemplate }
    ]
  },
  {
    name: 'Config & Storage',
    templates: [
      { name: 'ConfigMap', content: configMapTemplate },
      { name: 'Secret', content: secretTemplate },
      { name: 'PersistentVolumeClaim', content: persistentVolumeClaimTemplate },
      { name: 'PersistentVolume', content: persistentVolumeTemplate },
      { name: 'StorageClass', content: storageClassTemplate }
    ]
  },
  {
    name: 'Access Control',
    templates: [
      { name: 'ServiceAccount', content: serviceAccountTemplate },
      { name: 'Role', content: roleTemplate },
      { name: 'RoleBinding', content: roleBindingTemplate },
      { name: 'ClusterRole', content: clusterRoleTemplate },
      { name: 'ClusterRoleBinding', content: clusterRoleBindingTemplate }
    ]
  },
  {
    name: 'Cluster & Scaling',
    templates: [
      { name: 'Namespace', content: namespaceTemplate },
      { name: 'HorizontalPodAutoscaler', content: horizontalPodAutoscalerTemplate },
      { name: 'PodDisruptionBudget', content: podDisruptionBudgetTemplate },
      { name: 'ResourceQuota', content: resourceQuotaTemplate },
      { name: 'LimitRange', content: limitRangeTemplate },
      { name: 'PriorityClass', content: priorityClassTemplate },
      { name: 'RuntimeClass', content: runtimeClassTemplate },
      { name: 'Lease', content: leaseTemplate },
      { name: 'MutatingWebhookConfiguration', content: mutatingWebhookConfigurationTemplate },
      { name: 'ValidatingWebhookConfiguration', content: validatingWebhookConfigurationTemplate }
    ]
  }
];

export const DEFAULT_TEMPLATES = RESOURCE_TEMPLATES;

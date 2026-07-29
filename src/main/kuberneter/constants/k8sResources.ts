export interface K8sResourceDefinition {
  key: string;
  singular: string;
  displayName: string;
  group: string;
  version: string;
  isClusterScoped?: boolean;
  aliases?: string[];
}

export const K8S_RESOURCE_KEYS = {
  PODS: 'pods',
  SERVICES: 'services',
  CONFIGMAPS: 'configmaps',
  SECRETS: 'secrets',
  NAMESPACES: 'namespaces',
  NODES: 'nodes',
  EVENTS: 'events',
  ENDPOINTS: 'endpoints',
  PERSISTENT_VOLUME_CLAIMS: 'persistentvolumeclaims',
  PERSISTENT_VOLUMES: 'persistentvolumes',
  RESOURCE_QUOTAS: 'resourcequotas',
  LIMIT_RANGES: 'limitranges',
  SERVICE_ACCOUNTS: 'serviceaccounts',
  DEPLOYMENTS: 'deployments',
  STATEFUL_SETS: 'statefulsets',
  DAEMON_SETS: 'daemonsets',
  REPLICA_SETS: 'replicasets',
  JOBS: 'jobs',
  CRON_JOBS: 'cronjobs',
  INGRESSES: 'ingresses',
  INGRESS_CLASSES: 'ingressclasses',
  NETWORK_POLICIES: 'networkpolicies',
  ENDPOINT_SLICES: 'endpointslices',
  STORAGE_CLASSES: 'storageclasses',
  ROLES: 'roles',
  ROLE_BINDINGS: 'rolebindings',
  CLUSTER_ROLES: 'clusterroles',
  CLUSTER_ROLE_BINDINGS: 'clusterrolebindings',
  POD_DISRUPTION_BUDGETS: 'poddisruptionbudgets',
  PRIORITY_CLASSES: 'priorityclasses',
  RUNTIME_CLASSES: 'runtimeclasses',
  LEASES: 'leases',
  MUTATING_WEBHOOK_CONFIGURATIONS: 'mutatingwebhookconfigurations',
  VALIDATING_WEBHOOK_CONFIGURATIONS: 'validatingwebhookconfigurations',
  HORIZONTAL_POD_AUTOSCALERS: 'horizontalpodautoscalers'
} as const;

export const K8S_RESOURCE_MAP: Record<string, K8sResourceDefinition> = {
  pods: {
    key: K8S_RESOURCE_KEYS.PODS,
    singular: 'pod',
    displayName: 'Pods',
    group: 'api',
    version: 'v1',
    aliases: ['po']
  },
  services: {
    key: K8S_RESOURCE_KEYS.SERVICES,
    singular: 'service',
    displayName: 'Services',
    group: 'api',
    version: 'v1',
    aliases: ['svc']
  },
  configmaps: {
    key: K8S_RESOURCE_KEYS.CONFIGMAPS,
    singular: 'configmap',
    displayName: 'ConfigMaps',
    group: 'api',
    version: 'v1',
    aliases: ['cm']
  },
  secrets: {
    key: K8S_RESOURCE_KEYS.SECRETS,
    singular: 'secret',
    displayName: 'Secrets',
    group: 'api',
    version: 'v1'
  },
  namespaces: {
    key: K8S_RESOURCE_KEYS.NAMESPACES,
    singular: 'namespace',
    displayName: 'Namespaces',
    group: 'api',
    version: 'v1',
    isClusterScoped: true,
    aliases: ['ns']
  },
  nodes: {
    key: K8S_RESOURCE_KEYS.NODES,
    singular: 'node',
    displayName: 'Nodes',
    group: 'api',
    version: 'v1',
    isClusterScoped: true,
    aliases: ['no']
  },
  events: {
    key: K8S_RESOURCE_KEYS.EVENTS,
    singular: 'event',
    displayName: 'Events',
    group: 'api',
    version: 'v1',
    aliases: ['ev']
  },
  endpoints: {
    key: K8S_RESOURCE_KEYS.ENDPOINTS,
    singular: 'endpoint',
    displayName: 'Endpoints',
    group: 'api',
    version: 'v1',
    aliases: ['ep']
  },
  persistentvolumeclaims: {
    key: K8S_RESOURCE_KEYS.PERSISTENT_VOLUME_CLAIMS,
    singular: 'persistentvolumeclaim',
    displayName: 'PersistentVolumeClaims',
    group: 'api',
    version: 'v1',
    aliases: ['pvc']
  },
  pvcs: {
    key: K8S_RESOURCE_KEYS.PERSISTENT_VOLUME_CLAIMS,
    singular: 'persistentvolumeclaim',
    displayName: 'PersistentVolumeClaims',
    group: 'api',
    version: 'v1',
    aliases: ['pvc']
  },
  persistentvolumes: {
    key: K8S_RESOURCE_KEYS.PERSISTENT_VOLUMES,
    singular: 'persistentvolume',
    displayName: 'PersistentVolumes',
    group: 'api',
    version: 'v1',
    isClusterScoped: true,
    aliases: ['pv']
  },
  pvs: {
    key: K8S_RESOURCE_KEYS.PERSISTENT_VOLUMES,
    singular: 'persistentvolume',
    displayName: 'PersistentVolumes',
    group: 'api',
    version: 'v1',
    isClusterScoped: true,
    aliases: ['pv']
  },
  resourcequotas: {
    key: K8S_RESOURCE_KEYS.RESOURCE_QUOTAS,
    singular: 'resourcequota',
    displayName: 'ResourceQuotas',
    group: 'api',
    version: 'v1',
    aliases: ['quota']
  },
  limitranges: {
    key: K8S_RESOURCE_KEYS.LIMIT_RANGES,
    singular: 'limitrange',
    displayName: 'LimitRanges',
    group: 'api',
    version: 'v1',
    aliases: ['limits']
  },
  serviceaccounts: {
    key: K8S_RESOURCE_KEYS.SERVICE_ACCOUNTS,
    singular: 'serviceaccount',
    displayName: 'ServiceAccounts',
    group: 'api',
    version: 'v1',
    aliases: ['sa']
  },
  deployments: {
    key: K8S_RESOURCE_KEYS.DEPLOYMENTS,
    singular: 'deployment',
    displayName: 'Deployments',
    group: 'apis/apps',
    version: 'v1',
    aliases: ['deploy']
  },
  statefulsets: {
    key: K8S_RESOURCE_KEYS.STATEFUL_SETS,
    singular: 'statefulset',
    displayName: 'StatefulSets',
    group: 'apis/apps',
    version: 'v1',
    aliases: ['sts']
  },
  daemonsets: {
    key: K8S_RESOURCE_KEYS.DAEMON_SETS,
    singular: 'daemonset',
    displayName: 'DaemonSets',
    group: 'apis/apps',
    version: 'v1',
    aliases: ['ds']
  },
  replicasets: {
    key: K8S_RESOURCE_KEYS.REPLICA_SETS,
    singular: 'replicaset',
    displayName: 'ReplicaSets',
    group: 'apis/apps',
    version: 'v1',
    aliases: ['rs']
  },
  jobs: {
    key: K8S_RESOURCE_KEYS.JOBS,
    singular: 'job',
    displayName: 'Jobs',
    group: 'apis/batch',
    version: 'v1'
  },
  cronjobs: {
    key: K8S_RESOURCE_KEYS.CRON_JOBS,
    singular: 'cronjob',
    displayName: 'CronJobs',
    group: 'apis/batch',
    version: 'v1',
    aliases: ['cj']
  },
  ingresses: {
    key: K8S_RESOURCE_KEYS.INGRESSES,
    singular: 'ingress',
    displayName: 'Ingresses',
    group: 'apis/networking.k8s.io',
    version: 'v1',
    aliases: ['ing']
  },
  ingressclasses: {
    key: K8S_RESOURCE_KEYS.INGRESS_CLASSES,
    singular: 'ingressclass',
    displayName: 'IngressClasses',
    group: 'apis/networking.k8s.io',
    version: 'v1',
    isClusterScoped: true
  },
  networkpolicies: {
    key: K8S_RESOURCE_KEYS.NETWORK_POLICIES,
    singular: 'networkpolicy',
    displayName: 'NetworkPolicies',
    group: 'apis/networking.k8s.io',
    version: 'v1',
    aliases: ['netpol']
  },
  endpointslices: {
    key: K8S_RESOURCE_KEYS.ENDPOINT_SLICES,
    singular: 'endpointslice',
    displayName: 'EndpointSlices',
    group: 'apis/discovery.k8s.io',
    version: 'v1'
  },
  storageclasses: {
    key: K8S_RESOURCE_KEYS.STORAGE_CLASSES,
    singular: 'storageclass',
    displayName: 'StorageClasses',
    group: 'apis/storage.k8s.io',
    version: 'v1',
    isClusterScoped: true,
    aliases: ['sc']
  },
  roles: {
    key: K8S_RESOURCE_KEYS.ROLES,
    singular: 'role',
    displayName: 'Roles',
    group: 'apis/rbac.authorization.k8s.io',
    version: 'v1'
  },
  rolebindings: {
    key: K8S_RESOURCE_KEYS.ROLE_BINDINGS,
    singular: 'rolebinding',
    displayName: 'RoleBindings',
    group: 'apis/rbac.authorization.k8s.io',
    version: 'v1'
  },
  bindings: {
    key: 'bindings',
    singular: 'binding',
    displayName: 'Bindings',
    group: 'apis/rbac.authorization.k8s.io',
    version: 'v1'
  },
  clusterroles: {
    key: K8S_RESOURCE_KEYS.CLUSTER_ROLES,
    singular: 'clusterrole',
    displayName: 'ClusterRoles',
    group: 'apis/rbac.authorization.k8s.io',
    version: 'v1',
    isClusterScoped: true
  },
  clusterrolebindings: {
    key: K8S_RESOURCE_KEYS.CLUSTER_ROLE_BINDINGS,
    singular: 'clusterrolebinding',
    displayName: 'ClusterRoleBindings',
    group: 'apis/rbac.authorization.k8s.io',
    version: 'v1',
    isClusterScoped: true
  },
  poddisruptionbudgets: {
    key: K8S_RESOURCE_KEYS.POD_DISRUPTION_BUDGETS,
    singular: 'poddisruptionbudget',
    displayName: 'PodDisruptionBudgets',
    group: 'apis/policy',
    version: 'v1',
    aliases: ['pdb']
  },
  pdbs: {
    key: K8S_RESOURCE_KEYS.POD_DISRUPTION_BUDGETS,
    singular: 'poddisruptionbudget',
    displayName: 'PodDisruptionBudgets',
    group: 'apis/policy',
    version: 'v1',
    aliases: ['pdb']
  },
  priorityclasses: {
    key: K8S_RESOURCE_KEYS.PRIORITY_CLASSES,
    singular: 'priorityclass',
    displayName: 'PriorityClasses',
    group: 'apis/scheduling.k8s.io',
    version: 'v1',
    isClusterScoped: true,
    aliases: ['pc']
  },
  runtimeclasses: {
    key: K8S_RESOURCE_KEYS.RUNTIME_CLASSES,
    singular: 'runtimeclass',
    displayName: 'RuntimeClasses',
    group: 'apis/node.k8s.io',
    version: 'v1',
    isClusterScoped: true
  },
  leases: {
    key: K8S_RESOURCE_KEYS.LEASES,
    singular: 'lease',
    displayName: 'Leases',
    group: 'apis/coordination.k8s.io',
    version: 'v1'
  },
  mutatingwebhookconfigurations: {
    key: K8S_RESOURCE_KEYS.MUTATING_WEBHOOK_CONFIGURATIONS,
    singular: 'mutatingwebhookconfiguration',
    displayName: 'MutatingWebhookConfigurations',
    group: 'apis/admissionregistration.k8s.io',
    version: 'v1',
    isClusterScoped: true
  },
  validatingwebhookconfigurations: {
    key: K8S_RESOURCE_KEYS.VALIDATING_WEBHOOK_CONFIGURATIONS,
    singular: 'validatingwebhookconfiguration',
    displayName: 'ValidatingWebhookConfigurations',
    group: 'apis/admissionregistration.k8s.io',
    version: 'v1',
    isClusterScoped: true
  },
  horizontalpodautoscalers: {
    key: K8S_RESOURCE_KEYS.HORIZONTAL_POD_AUTOSCALERS,
    singular: 'horizontalpodautoscaler',
    displayName: 'HorizontalPodAutoscalers',
    group: 'apis/autoscaling',
    version: 'v2',
    aliases: ['hpa']
  }
};

/**
 * Returns the resource definition or fallback for custom/CRD resources
 */
export function getResourceDefinition(resource: string): K8sResourceDefinition {
  const key = resource.toLowerCase();
  if (K8S_RESOURCE_MAP[key]) {
    return K8S_RESOURCE_MAP[key];
  }
  for (const def of Object.values(K8S_RESOURCE_MAP)) {
    if (def.singular === key || def.aliases?.includes(key)) {
      return def;
    }
  }
  return {
    key,
    singular: key,
    displayName: resource,
    group: 'api',
    version: 'v1'
  };
}

/**
 * Helper to check whether a resource is cluster-scoped
 */
export function isClusterScopedResource(resource: string): boolean {
  const def = getResourceDefinition(resource);
  return !!def.isClusterScoped;
}

/**
 * Helper to construct direct K8s REST API URL path
 */
export function buildKubeApiPath(resource: string, namespace?: string): string {
  const def = getResourceDefinition(resource);
  const prefix = def.group === 'api' ? '/api/v1' : `/${def.group}/${def.version}`;

  if (def.isClusterScoped) {
    return `${prefix}/${def.key}`;
  }

  if (namespace && namespace !== 'All Namespaces') {
    return `${prefix}/namespaces/${namespace}/${def.key}`;
  }

  return `${prefix}/${def.key}`;
}

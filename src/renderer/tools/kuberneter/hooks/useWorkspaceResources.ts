import { useLayoutStore } from '../../../src/store/layout.store';
import { useKuberneterStore } from '../store/kuberneter.store';
import { usePods } from './usePods';
import { useDeployments } from './useDeployments';
import { useDaemonSets } from './useDaemonSets';
import { useStatefulSets } from './useStatefulSets';
import { useReplicaSets } from './useReplicaSets';
import { useJobs } from './useJobs';
import { useCronJobs } from './useCronJobs';
import { useServices } from './useServices';
import { useConfigMaps } from './useConfigMaps';
import { useSecrets } from './useSecrets';
import { useResourceQuotas } from './useResourceQuotas';
import { useLimitRanges } from './useLimitRanges';
import { useHpas } from './useHpas';
import { usePdbs } from './usePdbs';
import { usePriorityClasses } from './usePriorityClasses';
import { useRuntimeClasses } from './useRuntimeClasses';
import { useLeases } from './useLeases';
import { useMutatingWebhooks } from './useMutatingWebhooks';
import { useValidatingWebhooks } from './useValidatingWebhooks';
import { useApplications } from './useApplications';
import { useNodes } from './useNodes';
import { useEndpointSlices } from './useEndpointSlices';
import { useEndpoints } from './useEndpoints';
import { useIngresses } from './useIngresses';
import { useIngressClasses } from './useIngressClasses';
import { useNetworkPolicies } from './useNetworkPolicies';
import { usePersistentVolumeClaims } from './usePersistentVolumeClaims';
import { usePersistentVolumes } from './usePersistentVolumes';
import { useStorageClasses } from './useStorageClasses';
import { useNamespaces } from './useNamespaces';
import { useEvents } from './useEvents';
import { useServiceAccounts } from './useServiceAccounts';
import { useClusterRoles } from './useClusterRoles';
import { useRoles } from './useRoles';

export function useWorkspaceResources(resource: string) {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterSelectedCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const kuberneterSelectedNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );

  const pods = usePods(resource === 'pods');
  const deployments = useDeployments(resource === 'deployments');
  const daemonsets = useDaemonSets(resource === 'daemonsets');
  const statefulsets = useStatefulSets(resource === 'statefulsets');
  const replicasets = useReplicaSets(resource === 'replicasets');
  const jobs = useJobs(resource === 'jobs');
  const cronjobs = useCronJobs(resource === 'cronjobs');
  const services = useServices(resource === 'services');
  const configmaps = useConfigMaps(resource === 'configmaps');
  const secrets = useSecrets(resource === 'secrets');
  const resourcequotas = useResourceQuotas(resource === 'resourcequotas');
  const limitranges = useLimitRanges(resource === 'limitranges');
  const hpas = useHpas(resource === 'hpas');
  const pdbs = usePdbs(resource === 'pdbs');
  const priorityclasses = usePriorityClasses(resource === 'priorityclasses');
  const runtimeclasses = useRuntimeClasses(resource === 'runtimeclasses');
  const leases = useLeases(resource === 'leases');
  const mutatingwebhooks = useMutatingWebhooks(resource === 'mutatingwebhooks');
  const validatingwebhooks = useValidatingWebhooks(resource === 'validatingwebhooks');
  const apps = useApplications(resource === 'apps');
  const nodes = useNodes(resource === 'nodes');
  const endpointslices = useEndpointSlices(resource === 'endpointslices');
  const endpoints = useEndpoints(resource === 'endpoints');
  const ingresses = useIngresses(resource === 'ingresses');
  const ingressclasses = useIngressClasses(resource === 'ingressclasses');
  const networkpolicies = useNetworkPolicies(resource === 'networkpolicies');
  const pvcs = usePersistentVolumeClaims(resource === 'pvcs');
  const pvs = usePersistentVolumes(resource === 'pvs');
  const storageclasses = useStorageClasses(resource === 'storageclasses');
  const namespaces = useNamespaces(resource === 'namespaces');
  const events = useEvents(resource === 'events');
  const serviceaccounts = useServiceAccounts(resource === 'serviceaccounts');
  const clusterroles = useClusterRoles(resource === 'clusterroles');
  const roles = useRoles(resource === 'roles');

  let activeQuery: { data: unknown[]; isLoading: boolean; errorMsg: string | null } | null = null;
  if (resource === 'pods') activeQuery = pods;
  else if (resource === 'deployments') activeQuery = deployments;
  else if (resource === 'daemonsets') activeQuery = daemonsets;
  else if (resource === 'statefulsets') activeQuery = statefulsets;
  else if (resource === 'replicasets') activeQuery = replicasets;
  else if (resource === 'jobs') activeQuery = jobs;
  else if (resource === 'cronjobs') activeQuery = cronjobs;
  else if (resource === 'services') activeQuery = services;
  else if (resource === 'configmaps') activeQuery = configmaps;
  else if (resource === 'secrets') activeQuery = secrets;
  else if (resource === 'resourcequotas') activeQuery = resourcequotas;
  else if (resource === 'limitranges') activeQuery = limitranges;
  else if (resource === 'hpas') activeQuery = hpas;
  else if (resource === 'pdbs') activeQuery = pdbs;
  else if (resource === 'priorityclasses') activeQuery = priorityclasses;
  else if (resource === 'runtimeclasses') activeQuery = runtimeclasses;
  else if (resource === 'leases') activeQuery = leases;
  else if (resource === 'mutatingwebhooks') activeQuery = mutatingwebhooks;
  else if (resource === 'validatingwebhooks') activeQuery = validatingwebhooks;
  else if (resource === 'apps') activeQuery = apps;
  else if (resource === 'nodes') activeQuery = nodes;
  else if (resource === 'endpointslices') activeQuery = endpointslices;
  else if (resource === 'endpoints') activeQuery = endpoints;
  else if (resource === 'ingresses') activeQuery = ingresses;
  else if (resource === 'ingressclasses') activeQuery = ingressclasses;
  else if (resource === 'networkpolicies') activeQuery = networkpolicies;
  else if (resource === 'pvcs') activeQuery = pvcs;
  else if (resource === 'pvs') activeQuery = pvs;
  else if (resource === 'storageclasses') activeQuery = storageclasses;
  else if (resource === 'namespaces') activeQuery = namespaces;
  else if (resource === 'events') activeQuery = events;
  else if (resource === 'serviceaccounts') activeQuery = serviceaccounts;
  else if (resource === 'clusterroles') activeQuery = clusterroles;
  else if (resource === 'roles') activeQuery = roles;

  return {
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    podsData: pods.data,
    deploysData: deployments.data,
    daemonSetsData: daemonsets.data,
    statefulSetsData: statefulsets.data,
    replicaSetsData: replicasets.data,
    jobsData: jobs.data,
    cronJobsData: cronjobs.data,
    servicesData: services.data,
    configMapsData: configmaps.data,
    secretsData: secrets.data,
    resourceQuotasData: resourcequotas.data,
    limitRangesData: limitranges.data,
    hpasData: hpas.data,
    pdbsData: pdbs.data,
    priorityClassesData: priorityclasses.data,
    runtimeClassesData: runtimeclasses.data,
    leasesData: leases.data,
    mutatingWebhooksData: mutatingwebhooks.data,
    validatingWebhooksData: validatingwebhooks.data,
    applicationsData: apps.data,
    nodesData: nodes.data,
    endpointSlicesData: endpointslices.data,
    endpointsData: endpoints.data,
    ingressesData: ingresses.data,
    ingressClassesData: ingressclasses.data,
    networkPoliciesData: networkpolicies.data,
    pvcsData: pvcs.data,
    pvsData: pvs.data,
    storageClassesData: storageclasses.data,
    namespacesData: namespaces.data,
    eventsData: events.data,
    serviceAccountsData: serviceaccounts.data,
    clusterRolesData: clusterroles.data,
    rolesData: roles.data,
    isLoading: activeQuery ? activeQuery.isLoading : false,
    errorMsg: activeQuery ? activeQuery.errorMsg : null
  };
}

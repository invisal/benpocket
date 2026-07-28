import { useLayoutStore } from '../../../src/store/layout.store';
import { useKuberneterStore } from '../store/kuberneter.store';
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
import { useClusterRoleBindings } from './useClusterRoleBindings';
import { useRoleBindings } from './useRoleBindings';

export function useWorkspaceResources(resource: string) {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterSelectedCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const kuberneterSelectedNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );

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
  const clusterrolebindings = useClusterRoleBindings(resource === 'clusterrolebindings');
  const rolebindings = useRoleBindings(resource === 'bindings');

  let activeQuery: { data: unknown[]; isLoading: boolean; errorMsg: string | null } | null = null;
  if (resource === 'apps') activeQuery = apps;
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
  else if (resource === 'clusterrolebindings') activeQuery = clusterrolebindings;
  else if (resource === 'bindings') activeQuery = rolebindings;

  return {
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
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
    clusterRoleBindingsData: clusterrolebindings.data,
    roleBindingsData: rolebindings.data,
    isLoading: activeQuery ? activeQuery.isLoading : false,
    errorMsg: activeQuery ? activeQuery.errorMsg : null
  };
}

import { useLayoutStore } from '../../../src/store/layout.store';
import { useKuberneterStore } from '../store/kuberneter.store';
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
  if (resource === 'pvcs') activeQuery = pvcs;
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

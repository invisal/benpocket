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
import { useApplications } from './useApplications';
import { useNodes } from './useNodes';

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
  const apps = useApplications(resource === 'apps');
  const nodes = useNodes(resource === 'nodes');

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
  else if (resource === 'apps') activeQuery = apps;
  else if (resource === 'nodes') activeQuery = nodes;

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
    applicationsData: apps.data,
    nodesData: nodes.data,
    isLoading: activeQuery ? activeQuery.isLoading : false,
    errorMsg: activeQuery ? activeQuery.errorMsg : null
  };
}

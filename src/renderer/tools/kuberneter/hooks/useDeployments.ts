import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type DeployData } from '../types/DeployData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface DeploymentsExtraData {
  replicaSets?: K8sResource[];
  pods?: K8sResource[];
}

interface RelatedOwnerRef {
  kind: string;
  name: string;
}

interface RelatedReplicaSet {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    annotations?: Record<string, string>;
    ownerReferences?: RelatedOwnerRef[];
  };
  status?: {
    replicas?: number;
    readyReplicas?: number;
  };
}

interface RelatedPod {
  metadata?: {
    name?: string;
    namespace?: string;
    ownerReferences?: RelatedOwnerRef[];
  };
  spec?: {
    nodeName?: string;
  };
  status?: {
    phase?: string;
    containerStatuses?: Array<{
      ready?: boolean;
    }>;
  };
}

export function useDeployments(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[], extraData?: unknown) => {
      const extra = (extraData as DeploymentsExtraData) || { replicaSets: [], pods: [] };

      const rawReplicaSets = (extra.replicaSets || []) as unknown as RelatedReplicaSet[];
      const rawPods = (extra.pods || []) as unknown as RelatedPod[];

      return items.map((item) => {
        const deployItem = item;
        const name = deployItem.metadata?.name || '';
        const ns = deployItem.metadata?.namespace || '';
        const replicas = deployItem.spec?.replicas ?? 0;
        const readyReplicas = deployItem.status?.readyReplicas ?? 0;
        const upToDate = deployItem.status?.updatedReplicas ?? 0;
        const available = deployItem.status?.availableReplicas ?? 0;

        let status = 'Pending';
        if (replicas > 0 && readyReplicas === replicas) {
          status = 'Running';
        }

        const hasWarning = replicas > 0 && available < replicas;
        const strategy = deployItem.spec?.strategy?.type || 'RollingUpdate';

        // Filter ReplicaSets belonging to this deployment
        const matchedRSList = rawReplicaSets.filter((rs) => {
          const ownerRefs = rs.metadata?.ownerReferences || [];
          return (
            rs.metadata?.namespace === ns &&
            ownerRefs.some((ref) => ref.kind === 'Deployment' && ref.name === name)
          );
        });

        // Map Revisions
        const revisionsList = matchedRSList
          .map((rs) => {
            const rev = parseInt(
              rs.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '0',
              10
            );
            const rsReplicas = rs.status?.replicas ?? 0;
            const rsReady = rs.status?.readyReplicas ?? 0;
            return {
              revision: rev,
              name: rs.metadata?.name || '',
              podsCount: `${rsReady}/${rsReplicas}`,
              age: formatAge(rs.metadata?.creationTimestamp || ''),
              creationTimestamp: rs.metadata?.creationTimestamp || ''
            };
          })
          .sort((a, b) => b.revision - a.revision);

        // Filter Pods belonging to the matched ReplicaSets
        const matchedRSNames = new Set(
          matchedRSList.map((rs) => rs.metadata?.name).filter(Boolean)
        );
        const matchedPods = rawPods.filter((pod) => {
          const ownerRefs = pod.metadata?.ownerReferences || [];
          return (
            pod.metadata?.namespace === ns &&
            ownerRefs.some((ref) => ref.kind === 'ReplicaSet' && matchedRSNames.has(ref.name))
          );
        });

        // Map Pods
        const podsList = matchedPods.map((pod) => {
          const podName = pod.metadata?.name || '';
          const node = pod.spec?.nodeName || '—';
          const containerStatuses = pod.status?.containerStatuses || [];
          const readyCount = containerStatuses.filter((c) => c.ready).length;
          const totalCount = containerStatuses.length;
          const readyStr = `${readyCount}/${totalCount}`;
          const phase = pod.status?.phase || 'Unknown';
          const hasPodWarning = phase !== 'Running' && phase !== 'Succeeded';

          return {
            name: podName,
            node,
            ns,
            ready: readyStr,
            cpu: '0.000',
            memory: '35.0MiB',
            status: phase,
            hasWarning: hasPodWarning
          };
        });

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          ready: `${readyReplicas}/${replicas}`,
          upToDate,
          available,
          age: formatAge(deployItem.metadata?.creationTimestamp || ''),
          rawAge: new Date(deployItem.metadata?.creationTimestamp || Date.now())
            .getTime()
            .toString(),
          replicas,
          status,
          hasWarning,
          strategy,
          rawItem: item,
          revisions: revisionsList,
          podsList
        };
      });
    },
    []
  );

  const fetchExtraData = useMemo(
    () => async (configPath: string | undefined, cluster: string, ns: string) => {
      try {
        const [replicaSetsRes, podsRes] = await Promise.all([
          window.kuberneter.getResources(configPath, cluster, 'replicasets', ns),
          window.kuberneter.getResources(configPath, cluster, 'pods', ns)
        ]);
        return {
          replicaSets: replicaSetsRes?.items || [],
          pods: podsRes?.items || []
        };
      } catch (e) {
        console.warn('Failed to fetch deployments extra data', e);
        return { replicaSets: [], pods: [] };
      }
    },
    []
  );

  return useKubeQuery<DeployData>('deployments', transform, enabled, fetchExtraData);
}

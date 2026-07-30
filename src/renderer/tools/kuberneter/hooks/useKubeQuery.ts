import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useLayoutStore } from '../../../src/store/layout.store';
import { useKuberneterStore } from '../store/kuberneter.store';
import { type K8sResource } from '../types/K8sResource';
import { useKubeWatch } from './useKubeWatch';

export function useKubeQuery<T>(
  queryResource: string,
  transform: (items: K8sResource[], extraData?: unknown) => Promise<T[]> | T[],
  enabled: boolean,
  fetchExtraData?: (configPath: string | undefined, cluster: string, ns: string) => Promise<unknown>
) {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterSelectedCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const kuberneterSelectedNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );
  const activeConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const isWatchActive = enabled && !!kuberneterSelectedCluster;

  // Subscribe to real-time watch push events for active workspace resource queries
  useKubeWatch(queryResource, isWatchActive);

  // Real-time watch handles updates; disable interval refetch
  const refetchInterval = false;

  const query = useQuery<T[]>({
    queryKey: [
      'kuberneter',
      'resource',
      activeConfigPath,
      kuberneterSelectedCluster,
      queryResource,
      kuberneterSelectedNamespace
    ],
    queryFn: async () => {
      const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;

      const [res, extraData] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          kuberneterSelectedCluster,
          queryResource,
          kuberneterSelectedNamespace
        ),
        fetchExtraData
          ? fetchExtraData(configPathArg, kuberneterSelectedCluster, kuberneterSelectedNamespace)
          : Promise.resolve(undefined)
      ]);

      if (res && res.error) {
        throw new Error(res.error);
      }

      const rawItems = (res?.items as K8sResource[]) || [];
      const transformed = await transform(rawItems, extraData);
      const enriched = transformed.map((tObj: unknown) => {
        if (tObj && typeof tObj === 'object') {
          const obj = tObj as Record<string, unknown>;
          const name = obj['name'] as string | undefined;
          const ns = (obj['ns'] || obj['namespace']) as string | undefined;
          let matchedRaw: K8sResource | undefined;
          if (name) {
            matchedRaw = rawItems.find(
              (raw) => raw.metadata?.name === name && (!ns || raw.metadata?.namespace === ns)
            );
          }
          return {
            ...obj,
            creationTimestamp:
              (obj['creationTimestamp'] as string) || matchedRaw?.metadata?.creationTimestamp || '',
            createdTime:
              (obj['createdTime'] as string) ||
              (matchedRaw?.metadata?.creationTimestamp
                ? new Date(matchedRaw.metadata.creationTimestamp).toLocaleString()
                : '')
          };
        }
        return tObj;
      }) as unknown as T[];

      return enriched;
    },
    enabled: enabled && !!kuberneterSelectedCluster,
    refetchInterval,
    placeholderData: keepPreviousData
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    errorMsg: query.error ? (query.error as Error).message : null,
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    refetch: query.refetch
  };
}

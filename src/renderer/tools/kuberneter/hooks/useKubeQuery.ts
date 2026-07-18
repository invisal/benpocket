import { useState, useEffect, useCallback, useRef } from 'react';
import { useLayoutStore } from '../../../src/store/layout.store';
import { useKuberneterStore } from '../store/kuberneter.store';
import { type K8sResource } from '../types/K8sResource';

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
  const refreshInterval = useKuberneterStore(
    (s) => s.kuberneterInstanceRefreshInterval[activeInstanceId] || '60s'
  );

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const transformRef = useRef(transform);
  const fetchExtraRef = useRef(fetchExtraData);

  useEffect(() => {
    transformRef.current = transform;
    fetchExtraRef.current = fetchExtraData;
  }, [transform, fetchExtraData]);

  const fetchResources = useCallback(
    async (isBackground = false) => {
      if (!enabled || !kuberneterSelectedCluster) return;

      if (!isBackground) {
        setIsLoading(true);
        setErrorMsg(null);
      }

      try {
        const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;

        const [res, extraData] = await Promise.all([
          window.kuberneter.getResources(
            configPathArg,
            kuberneterSelectedCluster,
            queryResource,
            kuberneterSelectedNamespace
          ),
          fetchExtraRef.current
            ? fetchExtraRef.current(
                configPathArg,
                kuberneterSelectedCluster,
                kuberneterSelectedNamespace
              )
            : Promise.resolve(undefined)
        ]);

        if (res && res.error) {
          setErrorMsg(res.error);
          return;
        }

        const rawItems = (res?.items as K8sResource[]) || [];
        const transformed = await transformRef.current(rawItems, extraData);
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
                (obj['creationTimestamp'] as string) ||
                matchedRaw?.metadata?.creationTimestamp ||
                '',
              createdTime:
                (obj['createdTime'] as string) ||
                (matchedRaw?.metadata?.creationTimestamp
                  ? new Date(matchedRaw.metadata.creationTimestamp).toLocaleString()
                  : '')
            };
          }
          return tObj;
        }) as unknown as T[];
        setData(enriched);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isBackground) {
          setErrorMsg(msg || 'Failed to fetch cluster resources.');
        } else {
          console.warn('Background fetch failed:', msg);
        }
      } finally {
        if (!isBackground) {
          setIsLoading(false);
        }
      }
    },
    [
      enabled,
      kuberneterSelectedCluster,
      activeConfigPath,
      queryResource,
      kuberneterSelectedNamespace
    ]
  );

  useEffect(() => {
    if (enabled) {
      queueMicrotask(() => fetchResources(false));
    }
  }, [fetchResources, enabled]);

  useEffect(() => {
    if (!enabled || refreshInterval === 'off' || !kuberneterSelectedCluster) return;

    const intervalMap: Record<string, number> = {
      '5s': 5000,
      '10s': 10000,
      '30s': 30000,
      '60s': 60000
    };

    const ms = intervalMap[refreshInterval] || 60000;
    const timer = setInterval(() => {
      fetchResources(true);
    }, ms);

    return () => clearInterval(timer);
  }, [fetchResources, enabled, kuberneterSelectedCluster, refreshInterval]);

  return {
    data,
    isLoading,
    errorMsg,
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace
  };
}

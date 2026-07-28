import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLayoutStore } from '../../../src/store/layout.store';
import { useKuberneterStore } from '../store/kuberneter.store';

export function useKubeWatch(queryResource: string, enabled: boolean) {
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (!enabled || !kuberneterSelectedCluster || !queryResource) {
      return;
    }

    const watchId = `watch-${queryResource}-${activeInstanceId}`;
    const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;

    window.kuberneter.startWatch(watchId, {
      kubeconfigPath: configPathArg,
      contextName: kuberneterSelectedCluster,
      resource: queryResource,
      namespace: kuberneterSelectedNamespace
    });

    const unsubscribe = window.kuberneter.onWatchEvent((event) => {
      if (event.id === watchId || event.resource === queryResource) {
        queryClient.invalidateQueries({
          queryKey: [
            'kuberneter',
            'resource',
            activeConfigPath,
            kuberneterSelectedCluster,
            queryResource,
            kuberneterSelectedNamespace
          ]
        });
      }
    });

    return () => {
      unsubscribe();
      window.kuberneter.stopWatch(watchId);
    };
  }, [
    enabled,
    queryResource,
    activeInstanceId,
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    activeConfigPath,
    queryClient
  ]);
}

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLayoutStore } from '../../../src/store/layout.store';
import { useKuberneterStore } from '../store/kuberneter.store';

export function useKubeWatch(queryResource: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const openTabs = useLayoutStore((s) => s.openTabs);

  const activeResource = useKuberneterStore(
    (s) => s.kuberneterInstanceResource[activeInstanceId] || ''
  );
  const kuberneterSelectedCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const kuberneterSelectedNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );
  const activeConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  // Check if current tab is active for this tool instance
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const isInstanceActive = activeTab ? activeTab.instanceId === activeInstanceId : true;

  const isAppsView =
    activeResource.toLowerCase() === 'apps' &&
    ['deployments', 'statefulsets', 'daemonsets'].includes(queryResource.toLowerCase());

  // Watch should ONLY be active when the user is currently viewing this resource
  const isResourceMatch =
    !queryResource ||
    !activeResource ||
    queryResource.toLowerCase() === activeResource.toLowerCase() ||
    activeResource.toLowerCase().includes(queryResource.toLowerCase()) ||
    isAppsView;

  const shouldWatch = enabled && isInstanceActive && isResourceMatch && !!kuberneterSelectedCluster;

  useEffect(() => {
    if (!shouldWatch || !kuberneterSelectedCluster || !queryResource) {
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

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = window.kuberneter.onWatchEvent((event) => {
      if (event.id === watchId) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
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
        }, 1000);
      }
    });

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      unsubscribe();
      window.kuberneter.stopWatch(watchId);
    };
  }, [
    shouldWatch,
    queryResource,
    activeInstanceId,
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    activeConfigPath,
    queryClient
  ]);
}

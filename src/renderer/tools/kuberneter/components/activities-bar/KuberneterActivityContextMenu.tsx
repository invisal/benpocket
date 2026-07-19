import type React from 'react';
import { useState, useEffect } from 'react';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { useLayoutStore } from '@renderer/store/layout.store';
import { useToolTabs } from '@renderer/components/providers/ToolProvider';
import { loadAllClusters, type AvailableCluster } from '../../lib/loadAllClusters';

interface KuberneterActivityContextMenuProps {
  tabId: string;
  payload: unknown;
}

export const KuberneterActivityContextMenu: React.FC<KuberneterActivityContextMenuProps> = ({
  tabId,
  payload
}) => {
  const { selectTab } = useToolTabs();
  const { closeAll, openTab, setActiveInstanceId } = useLayoutStore();
  const { kuberneterInstanceCluster, initInstance, kuberneterKubeconfigs } = useKuberneterStore();

  const [availableClusters, setAvailableClusters] = useState<AvailableCluster[]>([]);

  useEffect(() => {
    let active = true;
    loadAllClusters(kuberneterKubeconfigs).then((clusters) => {
      if (active) {
        setAvailableClusters(clusters);
      }
    });
    return () => {
      active = false;
    };
  }, [kuberneterKubeconfigs]);

  const instanceId = (payload as { instanceId?: string })?.instanceId || tabId;
  const currentCluster = kuberneterInstanceCluster[instanceId];

  return (
    <>
      {currentCluster && (
        <ContextMenu.Item
          onClick={() => {
            initInstance(instanceId);
            closeAll(instanceId);
            setActiveInstanceId(instanceId);
            selectTab(tabId);
          }}
        >
          Disconnect
        </ContextMenu.Item>
      )}
      {availableClusters.length > 0 && (
        <ContextMenu.SubmenuRoot>
          <ContextMenu.SubmenuTrigger>Clusters</ContextMenu.SubmenuTrigger>
          <ContextMenu.Content>
            {availableClusters.map((cluster) => {
              const isCurrent = currentCluster === cluster.name;
              return (
                <ContextMenu.Item
                  key={cluster.name}
                  onClick={() => {
                    if (!isCurrent) {
                      initInstance(instanceId, {
                        cluster: cluster.name,
                        configPath: cluster.configPath,
                        namespace: 'default',
                        server: cluster.server
                      });
                      closeAll(instanceId);
                      openTab({
                        id: `kuberneter-k8s-overview-${instanceId}`,
                        title: 'Cluster Overview',
                        type: 'kuberneter',
                        instanceId,
                        meta: { resource: 'overview' },
                        isPreview: true
                      });
                      setActiveInstanceId(instanceId);
                      selectTab(tabId);
                    }
                  }}
                >
                  <span className={isCurrent ? 'font-bold text-accent' : ''}>{cluster.name}</span>
                </ContextMenu.Item>
              );
            })}
          </ContextMenu.Content>
        </ContextMenu.SubmenuRoot>
      )}
      <ContextMenu.Separator />
    </>
  );
};

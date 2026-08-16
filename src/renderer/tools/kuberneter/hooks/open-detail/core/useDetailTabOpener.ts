import { useCallback } from 'react';
import { useLayoutStore } from '@renderer/store/layout.store';

export interface OpenDetailTabOptions {
  contentType: string;
  resourceTab: string;
  name: string;
  namespace?: string;
  title: string;
  payload: unknown;
}

export function useDetailTabOpener() {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const openTab = useLayoutStore((s) => s.openTab);
  const pinTab = useLayoutStore((s) => s.pinTab);

  const openDetailTab = useCallback(
    ({ contentType, resourceTab, name, namespace, title, payload }: OpenDetailTabOptions) => {
      if (!activeInstanceId || !name) return;

      if (activeTabId) {
        pinTab(activeTabId);
      }

      const nsPart = namespace ? `${namespace}-` : '';
      const tabId = `kuberneter-${contentType}-detail-${nsPart}${name}-${activeInstanceId}`;

      openTab({
        id: tabId,
        title,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: {
          resource: resourceTab,
          payload
        }
      });
    },
    [activeInstanceId, activeTabId, openTab, pinTab]
  );

  return { openDetailTab, activeInstanceId };
}

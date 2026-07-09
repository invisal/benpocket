import React, { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../src/store/layout.store';
import { useToolTabs } from '../../../src/components/providers/ToolProvider';

export const KubeTitleBar: React.FC = () => {
  const { activeTabId: activeToolTabId, tabs: toolTabs } = useToolTabs();
  const activeToolTab = toolTabs.find((t) => t.id === activeToolTabId);
  const isKuberneterActive = activeToolTab?.type === 'kuberneter';

  const currentInstanceId = isKuberneterActive
    ? (activeToolTab?.payload as { instanceId?: string })?.instanceId || ''
    : '';

  const {
    kuberneterInstanceCluster,
    kuberneterInstanceNamespace,
    setKuberneterInstanceNamespace,
    kuberneterInstanceConfigPath
  } = useLayoutStore();

  const cluster = currentInstanceId ? kuberneterInstanceCluster[currentInstanceId] || '' : '';
  const namespace = currentInstanceId
    ? kuberneterInstanceNamespace[currentInstanceId] || 'All Namespaces'
    : 'All Namespaces';
  const configPath = currentInstanceId
    ? kuberneterInstanceConfigPath[currentInstanceId] || 'default'
    : 'default';

  const [namespaces, setNamespaces] = useState<string[]>([
    'All Namespaces',
    'default',
    'kube-system',
    'ingress-nginx',
    'database'
  ]);

  useEffect(() => {
    if (!cluster || !currentInstanceId) return;

    const fetchNamespaces = async () => {
      try {
        const configPathArg = configPath === 'default' ? undefined : configPath;
        const res = await window.kuberneter.getResources(configPathArg, cluster, 'namespaces');
        if (res && Array.isArray(res.items)) {
          const names = res.items.map((item: any) => item.metadata?.name).filter(Boolean);
          setNamespaces(['All Namespaces', ...names]);
        }
      } catch (err) {
        console.error('Failed to load namespaces in titlebar:', err);
      }
    };

    fetchNamespaces();
  }, [cluster, configPath, currentInstanceId]);

  if (!cluster || !currentInstanceId) return null;

  return (
    <div className="flex items-center gap-1.5 text-zinc-300 font-semibold text-[10px] h-full titlebar-nodrag select-none">
      <span className="text-xs">☸️</span>
      <span className="truncate max-w-[120px]" title={cluster}>
        {cluster}
      </span>
      <span className="text-zinc-600">|</span>
      <span className="text-zinc-500 font-medium shrink-0">Namespace:</span>
      <select
        value={namespace}
        onChange={(e) => setKuberneterInstanceNamespace(currentInstanceId, e.target.value)}
        className="bg-transparent border-none text-zinc-300 font-semibold text-[10px] outline-none cursor-pointer focus:ring-0 py-0 pl-0 pr-4 shrink-0 font-sans"
      >
        {namespaces.map((ns) => (
          <option key={ns} value={ns} className="bg-surface-2 text-zinc-350 font-sans text-xs">
            {ns}
          </option>
        ))}
      </select>
    </div>
  );
};
export default KubeTitleBar;

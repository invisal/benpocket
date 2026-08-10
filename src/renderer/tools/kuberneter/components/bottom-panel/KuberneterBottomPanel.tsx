import type React from 'react';
import { useState } from 'react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { KuberneterBottomPanelHeader } from './KuberneterBottomPanelHeader';
import { KuberneterTerminalView } from './KuberneterTerminalView';
import { KuberneterResourceEditor } from './KuberneterResourceEditor';
import { generateTabId } from './types';
import { cn } from 'cnfast';

export const KuberneterBottomPanel: React.FC = () => {
  const { toggleBottomPanel, toggleMaximizeBottomPanel } = useLayoutStore();
  const isMaximized = useLayoutStore((s) => s.isBottomPanelMaximized);
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterInstanceCluster = useKuberneterStore((s) => s.kuberneterInstanceCluster);
  const kuberneterInstanceConfigPath = useKuberneterStore((s) => s.kuberneterInstanceConfigPath);
  const activeCluster = kuberneterInstanceCluster[activeInstanceId] || '';
  const activeConfigPath = kuberneterInstanceConfigPath[activeInstanceId] || 'default';

  const tabs = useKuberneterStore((s) => s.kuberneterBottomPanelTabs);
  const activeTabId = useKuberneterStore((s) => s.kuberneterActiveBottomPanelTabId);
  const setActiveTabId = useKuberneterStore((s) => s.setKuberneterActiveBottomPanelTabId);
  const addTab = useKuberneterStore((s) => s.addKuberneterBottomPanelTab);
  const closeTab = useKuberneterStore((s) => s.closeKuberneterBottomPanelTab);

  // Per-tab YAML state for Create Resource tabs
  const [resourceYamls, setResourceYamls] = useState<Record<string, string>>({});

  const handleAddTab = (type: 'terminal' | 'create-resource') => {
    const newId = generateTabId(type);
    const newTitle =
      type === 'terminal'
        ? `Terminal ${tabs.filter((t) => t.type === 'terminal').length + 1}`
        : 'Create resource';

    addTab({
      id: newId,
      type,
      title: newTitle
    });

    if (type === 'create-resource') {
      setResourceYamls((prev) => ({ ...prev, [newId]: '' }));
    }
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(id);
  };

  const handleApplyYaml = async (yamlContent: string) => {
    const res = await window.kuberneter.applyResourceYaml(
      yamlContent,
      activeConfigPath,
      activeCluster
    );
    if (res && res.yaml && activeTabId) {
      setResourceYamls((prev) => ({ ...prev, [activeTabId]: res.yaml! }));
    }
    return res;
  };

  return (
    <div className={cn('flex flex-col w-full h-full min-h-0 bg-surface-2 overflow-hidden')}>
      {/* Header Bar */}
      <KuberneterBottomPanelHeader
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onAddTab={handleAddTab}
        isMaximized={isMaximized}
        onToggleMaximize={toggleMaximizeBottomPanel}
        onClosePanel={toggleBottomPanel}
      />

      {/* Tab Contents View */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-1 relative">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          // Terminal tabs stay mounted while hidden so the PTY session and
          // scrollback survive tab switches (matching VS Code's behavior).
          if (tab.type === 'terminal') {
            return (
              <div
                key={tab.id}
                className={cn(
                  'absolute inset-0 flex flex-col min-h-0',
                  isActive ? 'z-10' : 'z-0 invisible pointer-events-none'
                )}
              >
                <KuberneterTerminalView
                  sessionId={tab.id}
                  contextName={activeCluster}
                  kubeconfigPath={activeConfigPath}
                  isActive={isActive}
                  initialCommand={tab.initialCommand}
                />
              </div>
            );
          }

          // Resource Editor tabs only render when active.
          if (!isActive) return null;
          return (
            <div key={tab.id} className="absolute inset-0 flex flex-col min-h-0 z-10">
              <KuberneterResourceEditor
                initialYaml={tab.initialYaml}
                yaml={resourceYamls[tab.id] ?? tab.initialYaml ?? ''}
                onChangeYaml={(newYaml) =>
                  setResourceYamls((prev) => ({ ...prev, [tab.id]: newYaml }))
                }
                onApply={handleApplyYaml}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

import type React from 'react';
import { useState } from 'react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { KuberneterBottomPanelHeader } from './KuberneterBottomPanelHeader';
import { KuberneterTerminalView } from './KuberneterTerminalView';
import { KuberneterCreateResourceView } from './KuberneterCreateResourceView';
import { type KuberneterBottomPanelTabItem, generateTabId } from './types';
import { cn } from 'cnfast';

export const KuberneterBottomPanel: React.FC = () => {
  const { toggleBottomPanel, toggleMaximizeBottomPanel, bottomPanelHeight } = useLayoutStore();
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterInstanceCluster = useKuberneterStore((s) => s.kuberneterInstanceCluster);
  const activeCluster = kuberneterInstanceCluster[activeInstanceId] || 'do-sgp1-l192-kube';

  const maxH = typeof window !== 'undefined' ? window.innerHeight - 32 : 800;
  const isMaximized = bottomPanelHeight >= maxH - 50;

  // Tabs state - defaults to Terminal tab
  const [tabs, setTabs] = useState<KuberneterBottomPanelTabItem[]>([
    { id: 'term-default', type: 'terminal', title: 'Terminal' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('term-default');

  // Per-tab YAML state for Create Resource tabs
  const [resourceYamls, setResourceYamls] = useState<Record<string, string>>({});

  // Terminal shell state per terminal tab
  const [terminalHistories, setTerminalHistories] = useState<Record<string, string[]>>({
    'term-default': [`Kubernetes cluster ${activeCluster} in context.`, `keppere@MacBook-Air ~ % `]
  });

  const currentTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleAddTab = (type: 'terminal' | 'create-resource') => {
    const newId = generateTabId(type);
    const newTitle =
      type === 'terminal'
        ? `Terminal ${tabs.filter((t) => t.type === 'terminal').length + 1}`
        : 'Create resource';
    const newTab: KuberneterBottomPanelTabItem = {
      id: newId,
      type,
      title: newTitle
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);

    if (type === 'terminal') {
      setTerminalHistories((prev) => ({
        ...prev,
        [newId]: [`Kubernetes cluster ${activeCluster} in context.`, `keppere@MacBook-Air ~ % `]
      }));
    } else {
      setResourceYamls((prev) => ({ ...prev, [newId]: '' }));
    }
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = tabs.filter((t) => t.id !== id);
    if (remaining.length === 0) {
      // Default to opening a fresh terminal tab if all tabs were closed
      const newId = generateTabId('terminal');
      const defaultTerm: KuberneterBottomPanelTabItem = {
        id: newId,
        type: 'terminal',
        title: 'Terminal'
      };
      setTabs([defaultTerm]);
      setActiveTabId(defaultTerm.id);
      setTerminalHistories((prev) => ({
        ...prev,
        [defaultTerm.id]: [
          `Kubernetes cluster ${activeCluster} in context.`,
          `keppere@MacBook-Air ~ % `
        ]
      }));
      return;
    }
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const handleTerminalSubmit = (cmd: string, tabId: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    let response = `Command executed: ${trimmed}`;
    if (trimmed === 'clear') {
      setTerminalHistories((prev) => ({
        ...prev,
        [tabId]: [`keppere@MacBook-Air ~ % `]
      }));
      return;
    } else if (trimmed === 'help') {
      response = 'Available commands: kubectl get nodes, kubectl get pods, clear, help';
    } else if (trimmed.startsWith('kubectl')) {
      response = `[kubectl] Executing command on cluster ${activeCluster}...`;
    }

    setTerminalHistories((prev) => ({
      ...prev,
      [tabId]: [
        ...(prev[tabId] || []),
        `keppere@MacBook-Air ~ % ${trimmed}`,
        response,
        `keppere@MacBook-Air ~ % `
      ]
    }));
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
      {currentTab && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-1">
          {/* VIEW A: TERMINAL TAB */}
          {currentTab.type === 'terminal' && (
            <KuberneterTerminalView
              activeCluster={activeCluster}
              history={terminalHistories[currentTab.id] || []}
              onSubmitCommand={(cmd) => handleTerminalSubmit(cmd, currentTab.id)}
            />
          )}

          {/* VIEW B: CREATE RESOURCE TAB */}
          {currentTab.type === 'create-resource' && (
            <KuberneterCreateResourceView
              yaml={resourceYamls[currentTab.id] || ''}
              onChangeYaml={(newYaml) =>
                setResourceYamls((prev) => ({ ...prev, [currentTab.id]: newYaml }))
              }
              onApply={() => {
                // Handle resource application logic
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

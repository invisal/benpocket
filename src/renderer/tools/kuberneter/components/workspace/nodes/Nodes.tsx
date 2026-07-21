import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type NodeData } from '../../../types/NodeData';
import { NodesToolbar } from './NodesToolbar';
import { NodesTable } from './NodesTable';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';

interface NodesProps {
  nodesData: NodeData[];
}

export const Nodes: React.FC<NodesProps> = ({ nodesData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedNodeId =
    drawerState?.isOpen && drawerState?.contentType === 'nodes'
      ? (drawerState?.payload as NodeData)?.id
      : undefined;

  const handleSelectNode = useCallback(
    (node: NodeData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'nodes',
          payload: node
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return nodesData.filter((node) => {
      if (!searchQuery) return true;

      const fields = [node.name, node.roles, node.version, node.conditions];

      if (useRegex) {
        try {
          const flags = caseSensitive ? '' : 'i';
          const regex = new RegExp(searchQuery, flags);
          return fields.some((f) => f && regex.test(f));
        } catch {
          return false;
        }
      } else {
        const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
        return fields.some((f) => {
          if (!f) return false;
          const val = caseSensitive ? f : f.toLowerCase();
          return val.includes(query);
        });
      }
    });
  }, [nodesData, searchQuery, caseSensitive, useRegex]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(filteredData.map((d) => d.id)) : new Set());
    },
    [filteredData]
  );

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleExportCSV = useCallback(() => {
    const headers = [
      'name',
      'cpu',
      'memory',
      'disk',
      'taints',
      'roles',
      'version',
      'age',
      'conditions'
    ];
    const rows = filteredData.map((node) => {
      // Escape conditions string if we use commas, or just use tabs
      return [
        node.name,
        node.rawCpu,
        node.rawMemory,
        node.rawDisk,
        node.taints,
        node.roles,
        node.version,
        node.rawAge,
        node.rawConditions
      ].join('\t');
    });

    // Using TSV format but naming .csv is common for Excel compatibility with tabs, or we can just use tabs.
    const csvContent = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'nodes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredData]);

  return (
    <KubeWorkspaceLayout
      header={
        <NodesToolbar
          searchQuery={searchQuery}
          caseSensitive={caseSensitive}
          useRegex={useRegex}
          totalCount={filteredData.length}
          onSearchChange={setSearchQuery}
          onCaseSensitiveToggle={() => setCaseSensitive((v) => !v)}
          onRegexToggle={() => setUseRegex((v) => !v)}
          onDownload={handleExportCSV}
        />
      }
    >
      <NodesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectNode={handleSelectNode}
        selectedNodeId={selectedNodeId}
      />
    </KubeWorkspaceLayout>
  );
};

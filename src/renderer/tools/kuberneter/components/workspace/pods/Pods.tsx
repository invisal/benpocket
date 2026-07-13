import React, { useState, useMemo, useCallback } from 'react';
import { PodData } from '../../../types/PodData';
import { PodsToolbar } from './PodsToolbar';
import { PodsTable } from './PodsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface PodsProps {
  podsData: PodData[];
  kuberneterSelectedNamespace: string;
}

export const Pods: React.FC<PodsProps> = ({ podsData, kuberneterSelectedNamespace }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedPodId =
    drawerState?.isOpen && drawerState?.contentType === 'pod'
      ? (drawerState?.payload as PodData)?.id
      : undefined;

  const handleSelectPod = useCallback(
    (pod: PodData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'pod',
          payload: pod
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return podsData.filter((pod) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        pod.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        pod.name,
        pod.ns,
        pod.status,
        pod.cpu,
        pod.memory,
        pod.controlledBy || '',
        pod.node || '',
        pod.qos || '',
        pod.age
      ];

      if (useRegex) {
        try {
          const flags = caseSensitive ? '' : 'i';
          const regex = new RegExp(searchQuery, flags);
          return fields.some((f) => regex.test(f));
        } catch {
          return false;
        }
      } else {
        const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
        return fields.some((f) => {
          const val = caseSensitive ? f : f.toLowerCase();
          return val.includes(query);
        });
      }
    });
  }, [podsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

  const handleDownloadCsv = () => {
    const dataToExport =
      selectedIds.size > 0 ? filteredData.filter((d) => selectedIds.has(d.id)) : filteredData;

    if (dataToExport.length === 0) return;

    const headers = [
      'Name',
      'Warning',
      'Namespace',
      'CPU',
      'Memory',
      'Restarts',
      'Controlled By',
      'Node',
      'QoS',
      'Status',
      'Age'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((p) => {
      const row = [
        `"${p.name}"`,
        `"${p.hasWarning ? 'Warning' : 'OK'}"`,
        `"${p.ns}"`,
        `"${p.cpu}"`,
        `"${p.memory}"`,
        p.restarts,
        `"${p.controlledBy || ''}"`,
        `"${p.node || ''}"`,
        `"${p.qos || ''}"`,
        `"${p.status}"`,
        `"${p.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pods-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <PodsToolbar
          searchQuery={searchQuery}
          caseSensitive={caseSensitive}
          useRegex={useRegex}
          totalCount={filteredData.length}
          selectedCount={selectedIds.size}
          onSearchChange={setSearchQuery}
          onCaseSensitiveToggle={() => setCaseSensitive((v) => !v)}
          onRegexToggle={() => setUseRegex((v) => !v)}
          onDownload={handleDownloadCsv}
        />
      }
    >
      <PodsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectPod={handleSelectPod}
        selectedPodId={selectedPodId}
      />
    </KubeWorkspaceLayout>
  );
};
export default Pods;

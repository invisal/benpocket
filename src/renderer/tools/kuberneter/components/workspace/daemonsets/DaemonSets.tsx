import React, { useState, useMemo, useCallback } from 'react';
import { DaemonSetData } from '../../../types/DaemonSetData';
import { DaemonSetsToolbar } from './DaemonSetsToolbar';
import { DaemonSetsTable } from './DaemonSetsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface DaemonSetsProps {
  daemonSetsData: DaemonSetData[];
  kuberneterSelectedNamespace: string;
}

export const DaemonSets: React.FC<DaemonSetsProps> = ({
  daemonSetsData,
  kuberneterSelectedNamespace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedDaemonSetId =
    drawerState?.isOpen && drawerState?.contentType === 'daemonset'
      ? (drawerState?.payload as DaemonSetData)?.id
      : undefined;

  const handleSelectDaemonSet = useCallback(
    (ds: DaemonSetData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'daemonset',
          payload: ds
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return daemonSetsData.filter((ds) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        ds.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [ds.name, ds.ns, ds.nodeSelector, ds.age];

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
  }, [daemonSetsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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
      'Desired',
      'Current',
      'Ready',
      'Up-to-Date',
      'Available',
      'Node Selector',
      'Age'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((d) => {
      const row = [
        `"${d.name}"`,
        `"${d.hasWarning ? 'Warning' : 'OK'}"`,
        `"${d.ns}"`,
        d.desired,
        d.current,
        d.ready,
        d.upToDate,
        d.available,
        `"${d.nodeSelector}"`,
        `"${d.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daemonsets-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <DaemonSetsToolbar
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
      <DaemonSetsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectDaemonSet={handleSelectDaemonSet}
        selectedDaemonSetId={selectedDaemonSetId}
      />
    </KubeWorkspaceLayout>
  );
};

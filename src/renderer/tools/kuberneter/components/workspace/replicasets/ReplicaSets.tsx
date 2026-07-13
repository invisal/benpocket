import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type ReplicaSetData } from '../../../types/ReplicaSetData';
import { ReplicaSetsToolbar } from './ReplicaSetsToolbar';
import { ReplicaSetsTable } from './ReplicaSetsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface ReplicaSetsProps {
  replicaSetsData: ReplicaSetData[];
  kuberneterSelectedNamespace: string;
}

export const ReplicaSets: React.FC<ReplicaSetsProps> = ({
  replicaSetsData,
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

  const selectedReplicaSetId =
    drawerState?.isOpen && drawerState?.contentType === 'replicaset'
      ? (drawerState?.payload as ReplicaSetData)?.id
      : undefined;

  const handleSelectReplicaSet = useCallback(
    (rs: ReplicaSetData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'replicaset',
          payload: rs
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return replicaSetsData.filter((rs) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        rs.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        rs.name,
        rs.ns,
        rs.desired.toString(),
        rs.current.toString(),
        rs.ready.toString(),
        rs.age
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
  }, [replicaSetsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Warning', 'Namespace', 'Desired', 'Current', 'Ready', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((d) => {
      const row = [
        `"${d.name}"`,
        `"${d.hasWarning ? 'Warning' : 'OK'}"`,
        `"${d.ns}"`,
        d.desired,
        d.current,
        d.ready,
        `"${d.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `replicasets-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <ReplicaSetsToolbar
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
      <ReplicaSetsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectReplicaSet={handleSelectReplicaSet}
        selectedReplicaSetId={selectedReplicaSetId}
      />
    </KubeWorkspaceLayout>
  );
};

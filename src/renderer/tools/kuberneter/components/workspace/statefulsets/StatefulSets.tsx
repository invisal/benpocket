import React, { useState, useMemo, useCallback } from 'react';
import { StatefulSetData } from '../../../types/StatefulSetData';
import { StatefulSetsToolbar } from './StatefulSetsToolbar';
import { StatefulSetsTable } from './StatefulSetsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface StatefulSetsProps {
  statefulSetsData: StatefulSetData[];
  kuberneterSelectedNamespace: string;
}

export const StatefulSets: React.FC<StatefulSetsProps> = ({
  statefulSetsData,
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

  const selectedStatefulSetId =
    drawerState?.isOpen && drawerState?.contentType === 'statefulset'
      ? (drawerState?.payload as StatefulSetData)?.id
      : undefined;

  const handleSelectStatefulSet = useCallback(
    (ss: StatefulSetData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'statefulset',
          payload: ss
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return statefulSetsData.filter((ss) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        ss.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [ss.name, ss.ns, ss.ready, ss.age];

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
  }, [statefulSetsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Warning', 'Namespace', 'Pods', 'Replicas', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((d) => {
      const row = [
        `"${d.name}"`,
        `"${d.hasWarning ? 'Warning' : 'OK'}"`,
        `"${d.ns}"`,
        `"${d.ready}"`,
        d.replicas,
        `"${d.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statefulsets-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <StatefulSetsToolbar
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
      <StatefulSetsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectStatefulSet={handleSelectStatefulSet}
        selectedStatefulSetId={selectedStatefulSetId}
      />
    </KubeWorkspaceLayout>
  );
};

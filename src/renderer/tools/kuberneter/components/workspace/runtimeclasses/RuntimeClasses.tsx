import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type RuntimeClassData } from '../../../types/RuntimeClassData';
import { RuntimeClassesToolbar } from './RuntimeClassesToolbar';
import { RuntimeClassesTable } from './RuntimeClassesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface RuntimeClassesProps {
  runtimeClassesData: RuntimeClassData[];
}

export const RuntimeClasses: React.FC<RuntimeClassesProps> = ({ runtimeClassesData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedRuntimeClassId =
    drawerState?.isOpen && drawerState?.contentType === 'runtimeclass'
      ? (drawerState?.payload as RuntimeClassData)?.id
      : undefined;

  const handleSelectRuntimeClass = useCallback(
    (rc: RuntimeClassData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'runtimeclass',
          payload: rc
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return runtimeClassesData.filter((rc) => {
      if (!searchQuery) return true;

      const labelsArr = rc.labels ? Object.entries(rc.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const fields = [rc.name, labelsStr, rc.handler, rc.nodeSelector || '', rc.age];

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
  }, [runtimeClassesData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Handler', 'Node Selector', 'Tolerations Count', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((rc) => {
      const row = [
        `"${rc.name}"`,
        `"${rc.handler}"`,
        `"${rc.nodeSelector || ''}"`,
        rc.tolerationsCount,
        `"${rc.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `runtimeclasses-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <RuntimeClassesToolbar
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
      <RuntimeClassesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectRuntimeClass={handleSelectRuntimeClass}
        selectedRuntimeClassId={selectedRuntimeClassId}
      />
    </KubeWorkspaceLayout>
  );
};

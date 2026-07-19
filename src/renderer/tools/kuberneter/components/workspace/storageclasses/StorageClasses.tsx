import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type StorageClassData } from '../../../types/StorageClassData';
import { StorageClassesToolbar } from './StorageClassesToolbar';
import { StorageClassesTable } from './StorageClassesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface StorageClassesProps {
  storageClassesData: StorageClassData[];
}

export const StorageClasses: React.FC<StorageClassesProps> = ({ storageClassesData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedScId =
    drawerState?.isOpen && drawerState?.contentType === 'storageclass'
      ? (drawerState?.payload as StorageClassData)?.id
      : undefined;

  const handleSelectSc = useCallback(
    (sc: StorageClassData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'storageclass',
          payload: sc
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return storageClassesData.filter((sc) => {
      if (!searchQuery) return true;

      const fields = [
        sc.name,
        sc.provisioner,
        sc.reclaimPolicy,
        sc.volumeBindingMode,
        sc.age,
        sc.isDefault ? 'Yes' : 'No'
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
  }, [storageClassesData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Provisioner', 'Reclaim Policy', 'Default', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((sc) => {
      const row = [
        `"${sc.name}"`,
        `"${sc.provisioner}"`,
        `"${sc.reclaimPolicy}"`,
        `"${sc.isDefault ? 'Yes' : ''}"`,
        `"${sc.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `storageclass-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <StorageClassesToolbar
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
      <StorageClassesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectSc={handleSelectSc}
        selectedScId={selectedScId}
      />
    </KubeWorkspaceLayout>
  );
};

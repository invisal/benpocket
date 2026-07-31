import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type PersistentVolumeData } from '../../../types/PersistentVolumeData';
import { PersistentVolumesToolbar } from './PersistentVolumesToolbar';
import { PersistentVolumesTable } from './PersistentVolumesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { ResourceView } from '../ResourceView';
import { usePersistentVolumes } from '../../../hooks/usePersistentVolumes';

export const PersistentVolumes: React.FC = () => {
  const { data: pvsData, isLoading, errorMsg } = usePersistentVolumes(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedPvId =
    drawerState?.isOpen && drawerState?.contentType === 'persistentvolume'
      ? (drawerState?.payload as PersistentVolumeData)?.id
      : undefined;

  const handleSelectPv = useCallback(
    (pv: PersistentVolumeData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'persistentvolume',
          payload: pv
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query (cluster scoped, so namespace filter doesn't apply)
  const filteredData = useMemo(() => {
    return pvsData.filter((pv) => {
      if (!searchQuery) return true;

      const fields = [
        pv.name,
        pv.status,
        pv.capacity,
        pv.storageClass,
        pv.reclaimPolicy,
        pv.volumeMode,
        pv.age,
        pv.claim?.name || '',
        pv.claim?.namespace || ''
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
  }, [pvsData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Storage Class', 'Capacity', 'Claim', 'Age', 'Status'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((pv) => {
      const claimStr = pv.claim ? `${pv.claim.namespace}/${pv.claim.name}` : '—';
      const row = [
        `"${pv.name}"`,
        `"${pv.storageClass}"`,
        `"${pv.capacity}"`,
        `"${claimStr}"`,
        `"${pv.age}"`,
        `"${pv.status}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pv-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResourceView isLoading={isLoading} errorMsg={errorMsg}>
      <KubeWorkspaceLayout
        header={
          <PersistentVolumesToolbar
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
        <PersistentVolumesTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectPv={handleSelectPv}
          selectedPvId={selectedPvId}
        />
      </KubeWorkspaceLayout>
    </ResourceView>
  );
};

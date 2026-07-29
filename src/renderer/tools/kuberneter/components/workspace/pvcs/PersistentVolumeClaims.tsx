import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type PersistentVolumeClaimData } from '../../../types/PersistentVolumeClaimData';
import { PersistentVolumeClaimsToolbar } from './PersistentVolumeClaimsToolbar';
import { PersistentVolumeClaimsTable } from './PersistentVolumeClaimsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { ResourceView } from '../ResourceView';
import { usePersistentVolumeClaims } from '../../../hooks/usePersistentVolumeClaims';

interface PersistentVolumeClaimsProps {
  kuberneterSelectedNamespace: string;
}

export const PersistentVolumeClaims: React.FC<PersistentVolumeClaimsProps> = ({
  kuberneterSelectedNamespace
}) => {
  const { data: pvcsData, isLoading, errorMsg } = usePersistentVolumeClaims(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedPvcId =
    drawerState?.isOpen && drawerState?.contentType === 'persistentvolumeclaim'
      ? (drawerState?.payload as PersistentVolumeClaimData)?.id
      : undefined;

  const handleSelectPvc = useCallback(
    (pvc: PersistentVolumeClaimData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'persistentvolumeclaim',
          payload: pvc
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return pvcsData.filter((pvc) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        pvc.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        pvc.name,
        pvc.ns,
        pvc.status,
        pvc.volume,
        pvc.capacity,
        pvc.storageClass,
        pvc.accessModes.join(', '),
        pvc.age,
        pvc.pods.join(', ')
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
  }, [pvcsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Storage Class', 'Size', 'Pods', 'Age', 'Status'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((p) => {
      const row = [
        `"${p.name}"`,
        `"${p.ns}"`,
        `"${p.storageClass}"`,
        `"${p.capacity}"`,
        `"${p.pods.join(', ')}"`,
        `"${p.age}"`,
        `"${p.status}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pvc-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResourceView isLoading={isLoading} errorMsg={errorMsg}>
      <KubeWorkspaceLayout
        header={
          <PersistentVolumeClaimsToolbar
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
        <PersistentVolumeClaimsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectPvc={handleSelectPvc}
          selectedPvcId={selectedPvcId}
        />
      </KubeWorkspaceLayout>
    </ResourceView>
  );
};

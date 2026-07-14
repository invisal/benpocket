import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type PodDisruptionBudgetData } from '../../../types/PodDisruptionBudgetData';
import { PodDisruptionBudgetsToolbar } from './PodDisruptionBudgetsToolbar';
import { PodDisruptionBudgetsTable } from './PodDisruptionBudgetsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface PodDisruptionBudgetsProps {
  pdbsData: PodDisruptionBudgetData[];
  kuberneterSelectedNamespace: string;
}

export const PodDisruptionBudgets: React.FC<PodDisruptionBudgetsProps> = ({
  pdbsData,
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

  const selectedPdbId =
    drawerState?.isOpen && drawerState?.contentType === 'poddisruptionbudget'
      ? (drawerState?.payload as PodDisruptionBudgetData)?.id
      : undefined;

  const handleSelectPdb = useCallback(
    (pdb: PodDisruptionBudgetData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'poddisruptionbudget',
          payload: pdb
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return pdbsData.filter((pdb) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        pdb.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const labelsArr = pdb.labels ? Object.entries(pdb.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const fields = [
        pdb.name,
        pdb.ns,
        labelsStr,
        pdb.selector || '',
        pdb.minAvailable,
        pdb.maxUnavailable,
        pdb.age
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
  }, [pdbsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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
      'Namespace',
      'Min Available',
      'Max Unavailable',
      'Current Healthy',
      'Desired Healthy',
      'Selector',
      'Age'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((pdb) => {
      const row = [
        `"${pdb.name}"`,
        `"${pdb.ns}"`,
        `"${pdb.minAvailable}"`,
        `"${pdb.maxUnavailable}"`,
        pdb.currentHealthy,
        pdb.desiredHealthy,
        `"${pdb.selector || ''}"`,
        `"${pdb.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pdbs-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <PodDisruptionBudgetsToolbar
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
      <PodDisruptionBudgetsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectPdb={handleSelectPdb}
        selectedPdbId={selectedPdbId}
      />
    </KubeWorkspaceLayout>
  );
};

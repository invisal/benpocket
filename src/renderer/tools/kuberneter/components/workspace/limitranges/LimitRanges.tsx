import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type LimitRangeData } from '../../../types/LimitRangeData';
import { LimitRangesToolbar } from './LimitRangesToolbar';
import { LimitRangesTable } from './LimitRangesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface LimitRangesProps {
  limitRangesData: LimitRangeData[];
  kuberneterSelectedNamespace: string;
}

export const LimitRanges: React.FC<LimitRangesProps> = ({
  limitRangesData,
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

  const selectedLimitRangeId =
    drawerState?.isOpen && drawerState?.contentType === 'limitrange'
      ? (drawerState?.payload as LimitRangeData)?.id
      : undefined;

  const handleSelectLimitRange = useCallback(
    (lr: LimitRangeData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'limitrange',
          payload: lr
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return limitRangesData.filter((lr) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        lr.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const labelsArr = lr.labels ? Object.entries(lr.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const limitsStr = lr.limits
        ? lr.limits
            .map(
              (l) =>
                `${l.type}:${l.resource} min=${l.min || ''} max=${l.max || ''} default=${l.defaultLimit || ''}`
            )
            .join(', ')
        : '';
      const fields = [lr.name, lr.ns, labelsStr, limitsStr, lr.age];

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
  }, [limitRangesData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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
      'Labels',
      'Limits (Type:Resource:Min/Max/DefaultLimit/DefaultRequest)',
      'Age'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((lr) => {
      const labelsArr = lr.labels ? Object.entries(lr.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join('; ');
      const limitsStr = lr.limits
        ? lr.limits
            .map(
              (l) =>
                `${l.type}:${l.resource} (min:${l.min || '—'}; max:${l.max || '—'}; defaultLimit:${l.defaultLimit || '—'}; defaultRequest:${l.defaultRequest || '—'})`
            )
            .join('; ')
        : '';
      const row = [`"${lr.name}"`, `"${lr.ns}"`, `"${labelsStr}"`, `"${limitsStr}"`, `"${lr.age}"`];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `limitranges-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <LimitRangesToolbar
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
      <LimitRangesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectLimitRange={handleSelectLimitRange}
        selectedLimitRangeId={selectedLimitRangeId}
      />
    </KubeWorkspaceLayout>
  );
};

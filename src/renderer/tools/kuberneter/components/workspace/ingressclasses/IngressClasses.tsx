import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type IngressClassData } from '../../../types/IngressClassData';
import { IngressClassesToolbar } from './IngressClassesToolbar';
import { IngressClassesTable } from './IngressClassesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface IngressClassesProps {
  ingressClassesData: IngressClassData[];
}

export const IngressClasses: React.FC<IngressClassesProps> = ({ ingressClassesData = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedIngressClassId =
    drawerState?.isOpen && drawerState?.contentType === 'ingressclasses'
      ? (drawerState?.payload as IngressClassData)?.id
      : undefined;

  const handleSelectIngressClass = useCallback(
    (ic: IngressClassData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'ingressclasses',
          payload: ic
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query (no namespace — cluster-scoped)
  const filteredData = useMemo(() => {
    return ingressClassesData.filter((ic) => {
      if (!searchQuery) return true;

      const fields = [ic.name, ic.controller, ic.parametersKind, ic.parametersApiGroup, ic.age];

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
  }, [ingressClassesData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Controller', 'API Group', 'Scope', 'Kind', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((ic) => {
      const row = [
        `"${ic.name}"`,
        `"${ic.controller}"`,
        `"${ic.parametersApiGroup}"`,
        `"${ic.parametersScope}"`,
        `"${ic.parametersKind}"`,
        `"${ic.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ingressclasses-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <IngressClassesToolbar
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
      <IngressClassesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectIngressClass={handleSelectIngressClass}
        selectedIngressClassId={selectedIngressClassId}
      />
    </KubeWorkspaceLayout>
  );
};

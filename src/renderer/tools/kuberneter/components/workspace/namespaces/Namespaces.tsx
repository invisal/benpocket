import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type NamespaceData } from '../../../types/NamespaceData';
import { NamespacesToolbar } from './NamespacesToolbar';
import { NamespacesTable } from './NamespacesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { ResourceView } from '../ResourceView';
import { useNamespaces } from '../../../hooks/useNamespaces';

export const Namespaces: React.FC = () => {
  const { data: namespacesData, isLoading, errorMsg } = useNamespaces(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedNsId =
    drawerState?.isOpen && drawerState?.contentType === 'namespace'
      ? (drawerState?.payload as NamespaceData)?.id
      : undefined;

  const handleSelectNs = useCallback(
    (ns: NamespaceData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'namespace',
          payload: ns
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return namespacesData.filter((ns) => {
      if (!searchQuery) return true;

      const labelsStr = ns.labels
        ? Object.entries(ns.labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
        : '';

      const fields = [ns.name, ns.status, ns.age, labelsStr];

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
  }, [namespacesData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Labels', 'Age', 'Status'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((ns) => {
      const labelsStr = ns.labels
        ? Object.entries(ns.labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(';')
        : '';
      const row = [`"${ns.name}"`, `"${labelsStr}"`, `"${ns.age}"`, `"${ns.status}"`];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `namespace-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResourceView isLoading={isLoading} errorMsg={errorMsg}>
      <KubeWorkspaceLayout
        header={
          <NamespacesToolbar
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
        <NamespacesTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectNs={handleSelectNs}
          selectedNsId={selectedNsId}
        />
      </KubeWorkspaceLayout>
    </ResourceView>
  );
};

import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type IngressData } from '../../../types/IngressData';
import { IngressesToolbar } from './IngressesToolbar';
import { IngressesTable } from './IngressesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface IngressesProps {
  ingressesData: IngressData[];
  kuberneterSelectedNamespace: string;
}

export const Ingresses: React.FC<IngressesProps> = ({
  ingressesData = [],
  kuberneterSelectedNamespace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedIngressId =
    drawerState?.isOpen && drawerState?.contentType === 'ingresses'
      ? (drawerState?.payload as IngressData)?.id
      : undefined;

  const handleSelectIngress = useCallback(
    (ing: IngressData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'ingresses',
          payload: ing
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  const handleNamespaceClick = useCallback(
    (ns: string) => {
      if (activeInstanceId) {
        useKuberneterStore.getState().setKuberneterInstanceNamespace(activeInstanceId, ns);
      }
    },
    [activeInstanceId]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return ingressesData.filter((ing) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        ing.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [ing.name, ing.ns, ing.loadBalancers, ing.rulesStr, ing.age];

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
  }, [ingressesData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'LoadBalancers', 'Rules', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((ing) => {
      const row = [
        `"${ing.name}"`,
        `"${ing.ns}"`,
        `"${ing.loadBalancers}"`,
        `"${ing.rulesStr}"`,
        `"${ing.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ingresses-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <IngressesToolbar
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
      <IngressesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectIngress={handleSelectIngress}
        onNamespaceClick={handleNamespaceClick}
        selectedIngressId={selectedIngressId}
      />
    </KubeWorkspaceLayout>
  );
};

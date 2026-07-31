import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type ServiceAccountData } from '../../../types/ServiceAccountData';
import { ServiceAccountsToolbar } from './ServiceAccountsToolbar';
import { ServiceAccountsTable } from './ServiceAccountsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { ResourceView } from '../ResourceView';
import { useServiceAccounts } from '../../../hooks/useServiceAccounts';

export const ServiceAccounts: React.FC = () => {
  const { data: serviceAccountsData, isLoading, errorMsg } = useServiceAccounts(true);

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterSelectedNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedSaId =
    drawerState?.isOpen && drawerState?.contentType === 'serviceaccount'
      ? (drawerState?.payload as ServiceAccountData)?.id
      : undefined;

  const handleSelectSa = useCallback(
    (sa: ServiceAccountData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'serviceaccount',
          payload: sa
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return serviceAccountsData.filter((sa) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        sa.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const labelsArr = sa.labels ? Object.entries(sa.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const fields = [sa.name, sa.ns, labelsStr, sa.age];

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
  }, [serviceAccountsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Secrets', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((sa) => {
      const row = [`"${sa.name}"`, `"${sa.ns}"`, `"${sa.secrets.join(';')}"`, `"${sa.age}"`];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `serviceaccounts-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResourceView isLoading={isLoading} errorMsg={errorMsg}>
      <KubeWorkspaceLayout
        header={
          <ServiceAccountsToolbar
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
        <ServiceAccountsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectServiceAccount={handleSelectSa}
          selectedServiceAccountId={selectedSaId}
        />
      </KubeWorkspaceLayout>
    </ResourceView>
  );
};

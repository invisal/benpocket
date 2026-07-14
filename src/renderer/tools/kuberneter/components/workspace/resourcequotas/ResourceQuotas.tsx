import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type ResourceQuotaData } from '../../../types/ResourceQuotaData';
import { ResourceQuotasToolbar } from './ResourceQuotasToolbar';
import { ResourceQuotasTable } from './ResourceQuotasTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface ResourceQuotasProps {
  resourceQuotasData: ResourceQuotaData[];
  kuberneterSelectedNamespace: string;
}

export const ResourceQuotas: React.FC<ResourceQuotasProps> = ({
  resourceQuotasData,
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

  const selectedResourceQuotaId =
    drawerState?.isOpen && drawerState?.contentType === 'resourcequota'
      ? (drawerState?.payload as ResourceQuotaData)?.id
      : undefined;

  const handleSelectResourceQuota = useCallback(
    (rq: ResourceQuotaData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'resourcequota',
          payload: rq
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return resourceQuotasData.filter((rq) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        rq.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const labelsArr = rq.labels ? Object.entries(rq.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const quotasStr = rq.quotas
        ? rq.quotas.map((q) => `${q.resourceName}=${q.used}/${q.hard}`).join(', ')
        : '';
      const fields = [rq.name, rq.ns, labelsStr, quotasStr, rq.age];

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
  }, [resourceQuotasData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Labels', 'Quotas (Resource: Used/Hard)', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((rq) => {
      const labelsArr = rq.labels ? Object.entries(rq.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join('; ');
      const quotasStr = rq.quotas
        ? rq.quotas.map((q) => `${q.resourceName}: ${q.used}/${q.hard}`).join('; ')
        : '';
      const row = [`"${rq.name}"`, `"${rq.ns}"`, `"${labelsStr}"`, `"${quotasStr}"`, `"${rq.age}"`];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resourcequotas-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <ResourceQuotasToolbar
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
      <ResourceQuotasTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectResourceQuota={handleSelectResourceQuota}
        selectedResourceQuotaId={selectedResourceQuotaId}
      />
    </KubeWorkspaceLayout>
  );
};

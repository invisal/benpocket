import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type LeaseData } from '../../../types/LeaseData';
import { LeasesToolbar } from './LeasesToolbar';
import { LeasesTable } from './LeasesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface LeasesProps {
  leasesData: LeaseData[];
  kuberneterSelectedNamespace: string;
}

export const Leases: React.FC<LeasesProps> = ({ leasesData, kuberneterSelectedNamespace }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedLeaseId =
    drawerState?.isOpen && drawerState?.contentType === 'lease'
      ? (drawerState?.payload as LeaseData)?.id
      : undefined;

  const handleSelectLease = useCallback(
    (lease: LeaseData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'lease',
          payload: lease
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return leasesData.filter((lease) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        lease.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const labelsArr = lease.labels ? Object.entries(lease.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const fields = [lease.name, lease.ns, labelsStr, lease.holder, lease.age];

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
  }, [leasesData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Holder', 'Lease Duration Seconds', 'Renew Time', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((l) => {
      const row = [
        `"${l.name}"`,
        `"${l.ns}"`,
        `"${l.holder}"`,
        l.durationSeconds,
        `"${l.renewTime}"`,
        `"${l.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leases-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <LeasesToolbar
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
      <LeasesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectLease={handleSelectLease}
        selectedLeaseId={selectedLeaseId}
      />
    </KubeWorkspaceLayout>
  );
};

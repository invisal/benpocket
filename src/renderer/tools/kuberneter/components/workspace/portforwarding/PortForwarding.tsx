import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type PortForwardData } from '../../../types/PortForwardData';
import { PortForwardingToolbar } from './PortForwardingToolbar';
import { PortForwardingTable } from './PortForwardingTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { usePortForwardingStore } from '../../../store/portForwarding.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

export const PortForwarding: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const portForwards = usePortForwardingStore((s) => s.portForwards);

  const selectedEntryId =
    drawerState?.isOpen && drawerState?.contentType === 'portforwarding'
      ? (drawerState?.payload as PortForwardData)?.id
      : undefined;

  const handleSelectEntry = useCallback(
    (entry: PortForwardData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'portforwarding',
          payload: entry
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return portForwards.filter((pf) => {
      if (!searchQuery) return true;

      const fields = [
        pf.name,
        pf.ns,
        pf.kind,
        String(pf.podPort),
        String(pf.localPort),
        pf.protocol,
        pf.status,
        pf.url
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
  }, [portForwards, searchQuery, caseSensitive, useRegex]);

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
      'Kind',
      'Pod Port',
      'Local Port',
      'Protocol',
      'Status',
      'URL'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((pf) => {
      const row = [
        `"${pf.name}"`,
        `"${pf.ns}"`,
        `"${pf.kind}"`,
        `"${pf.podPort}"`,
        `"${pf.localPort}"`,
        `"${pf.protocol}"`,
        `"${pf.status}"`,
        `"${pf.url}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `port-forwards-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <PortForwardingToolbar
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
      <PortForwardingTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectEntry={handleSelectEntry}
        selectedEntryId={selectedEntryId}
      />
    </KubeWorkspaceLayout>
  );
};

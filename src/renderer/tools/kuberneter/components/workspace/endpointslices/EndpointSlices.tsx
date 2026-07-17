import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type EndpointSliceData } from '../../../types/EndpointSliceData';
import { EndpointSlicesToolbar } from './EndpointSlicesToolbar';
import { EndpointSlicesTable } from './EndpointSlicesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface EndpointSlicesProps {
  endpointSlicesData: EndpointSliceData[];
  kuberneterSelectedNamespace: string;
}

export const EndpointSlices: React.FC<EndpointSlicesProps> = ({
  endpointSlicesData,
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

  const selectedEndpointSliceId =
    drawerState?.isOpen && drawerState?.contentType === 'endpointslice'
      ? (drawerState?.payload as EndpointSliceData)?.id
      : undefined;

  const handleSelectEndpointSlice = useCallback(
    (slice: EndpointSliceData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'endpointslice',
          payload: slice
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return endpointSlicesData.filter((slice) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        slice.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        slice.name,
        slice.ns,
        slice.addressType,
        slice.endpointsStr,
        slice.portsStr,
        slice.age
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
  }, [endpointSlicesData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Address Type', 'Endpoints', 'Ports', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((s) => {
      const row = [
        `"${s.name}"`,
        `"${s.ns}"`,
        `"${s.addressType}"`,
        `"${s.endpointsStr}"`,
        `"${s.portsStr}"`,
        `"${s.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `endpointslices-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <EndpointSlicesToolbar
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
      <EndpointSlicesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectEndpointSlice={handleSelectEndpointSlice}
        selectedEndpointSliceId={selectedEndpointSliceId}
      />
    </KubeWorkspaceLayout>
  );
};

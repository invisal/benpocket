import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type ServiceData } from '../../../types/ServiceData';
import { ServicesToolbar } from './ServicesToolbar';
import { ServicesTable } from './ServicesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface ServicesProps {
  servicesData: ServiceData[];
  kuberneterSelectedNamespace: string;
}

export const Services: React.FC<ServicesProps> = ({
  servicesData,
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

  const selectedServiceId =
    drawerState?.isOpen && drawerState?.contentType === 'service'
      ? (drawerState?.payload as ServiceData)?.id
      : undefined;

  const handleSelectService = useCallback(
    (service: ServiceData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'service',
          payload: service
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return servicesData.filter((svc) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        svc.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        svc.name,
        svc.ns,
        svc.type,
        svc.clusterIp,
        svc.ports,
        svc.externalIps,
        svc.selectorStr,
        svc.age,
        svc.status
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
  }, [servicesData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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
      'Type',
      'Cluster IP',
      'Ports',
      'External IP',
      'Selector',
      'Age',
      'Status'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((s) => {
      const row = [
        `"${s.name}"`,
        `"${s.ns}"`,
        `"${s.type}"`,
        `"${s.clusterIp}"`,
        `"${s.ports}"`,
        `"${s.externalIps}"`,
        `"${s.selectorStr}"`,
        `"${s.age}"`,
        `"${s.status}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `services-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <ServicesToolbar
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
      <ServicesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectService={handleSelectService}
        selectedServiceId={selectedServiceId}
      />
    </KubeWorkspaceLayout>
  );
};

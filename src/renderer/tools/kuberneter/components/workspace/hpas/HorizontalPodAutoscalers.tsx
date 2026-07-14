import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type HorizontalPodAutoscalerData } from '../../../types/HorizontalPodAutoscalerData';
import { HorizontalPodAutoscalersToolbar } from './HorizontalPodAutoscalersToolbar';
import { HorizontalPodAutoscalersTable } from './HorizontalPodAutoscalersTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface HorizontalPodAutoscalersProps {
  hpasData: HorizontalPodAutoscalerData[];
  kuberneterSelectedNamespace: string;
}

export const HorizontalPodAutoscalers: React.FC<HorizontalPodAutoscalersProps> = ({
  hpasData,
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

  const selectedHpaId =
    drawerState?.isOpen && drawerState?.contentType === 'horizontalpodautoscaler'
      ? (drawerState?.payload as HorizontalPodAutoscalerData)?.id
      : undefined;

  const handleSelectHpa = useCallback(
    (hpa: HorizontalPodAutoscalerData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'horizontalpodautoscaler',
          payload: hpa
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return hpasData.filter((hpa) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        hpa.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const labelsArr = hpa.labels ? Object.entries(hpa.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const metricsStr = hpa.metrics.map((m) => `${m.name}:${m.current}/${m.target}`).join(', ');
      const fields = [
        hpa.name,
        hpa.ns,
        labelsStr,
        metricsStr,
        hpa.referenceKind,
        hpa.referenceName,
        hpa.age,
        hpa.statusText
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
  }, [hpasData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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
      'Reference Kind',
      'Reference Name',
      'Min Pods',
      'Max Pods',
      'Replicas',
      'Metrics',
      'Age',
      'Status'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((hpa) => {
      const metricsStr = hpa.metrics.map((m) => `${m.name}:${m.current}/${m.target}`).join('; ');
      const row = [
        `"${hpa.name}"`,
        `"${hpa.ns}"`,
        `"${hpa.referenceKind}"`,
        `"${hpa.referenceName}"`,
        hpa.minPods,
        hpa.maxPods,
        hpa.replicas,
        `"${metricsStr}"`,
        `"${hpa.age}"`,
        `"${hpa.statusText}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hpas-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <HorizontalPodAutoscalersToolbar
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
      <HorizontalPodAutoscalersTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectHpa={handleSelectHpa}
        selectedHpaId={selectedHpaId}
      />
    </KubeWorkspaceLayout>
  );
};

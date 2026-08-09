import type React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { HelmChartsToolbar } from './HelmChartsToolbar';
import { HelmChartsTable } from './HelmChartsTable';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { type HelmChartItem } from '../../../../../../preload/kuberneter/api';
import { Loader2 } from 'lucide-react';

export const HelmCharts: React.FC = () => {
  const [charts, setCharts] = useState<HelmChartItem[]>([]);
  const [iconMap, setIconMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedChartName =
    drawerState?.isOpen && drawerState?.contentType === 'helm-chart'
      ? (drawerState?.payload as HelmChartItem)?.name
      : undefined;

  const handleSelectChart = useCallback(
    (chart: HelmChartItem) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'helm-chart',
          payload: chart
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  const activeConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const fetchChartsAndIcons = useCallback(async () => {
    setIsLoading(true);
    try {
      const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;

      const [chartsRes, iconsRes] = await Promise.all([
        window.kuberneter.helmSearchCharts(configPathArg),
        window.kuberneter.helmGetChartIcons()
      ]);

      if (chartsRes && 'helmNotFound' in chartsRes) {
        useKuberneterStore.getState().showHelmMissingToast();
        setCharts([]);
      } else if (chartsRes && 'noRepos' in chartsRes) {
        useKuberneterStore.getState().showHelmNoReposToast();
        setCharts([]);
      } else if (chartsRes && 'noCharts' in chartsRes) {
        useKuberneterStore.getState().showHelmNoReposToast();
        setCharts([]);
      } else if (Array.isArray(chartsRes)) {
        setCharts(chartsRes);
      }

      if (iconsRes && !('error' in iconsRes)) {
        setIconMap(iconsRes as Record<string, string>);
      }
    } catch (err) {
      console.error('[HelmCharts] fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeConfigPath]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchChartsAndIcons();
    });
  }, [fetchChartsAndIcons]);

  // Re-fetch when the window regains visibility (e.g. user switched to Settings to add repos)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchChartsAndIcons();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchChartsAndIcons]);

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return charts.filter((chart) => {
      if (!searchQuery) return true;

      const parts = chart.name.split('/');
      const chartName = parts[1] || chart.name;
      const repository = parts[0] || '';

      const fields = [chartName, chart.description, chart.version, chart.app_version, repository];

      if (useRegex) {
        try {
          const flags = caseSensitive ? '' : 'i';
          const regex = new RegExp(searchQuery, flags);
          return fields.some((f) => regex.test(f || ''));
        } catch {
          return false;
        }
      } else {
        const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
        return fields.some((f) => {
          const val = caseSensitive ? f || '' : (f || '').toLowerCase();
          return val.includes(query);
        });
      }
    });
  }, [charts, searchQuery, caseSensitive, useRegex]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(filteredData.map((d) => d.name)) : new Set());
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
      selectedIds.size > 0 ? filteredData.filter((d) => selectedIds.has(d.name)) : filteredData;

    if (dataToExport.length === 0) return;

    const headers = ['Name', 'Repository', 'Description', 'Version', 'App Version'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((chart) => {
      const parts = chart.name.split('/');
      const chartName = parts[1] || chart.name;
      const repository = parts[0] || '';

      const row = [
        `"${chartName}"`,
        `"${repository}"`,
        `"${chart.description.replace(/"/g, '""')}"`,
        `"${chart.version}"`,
        `"${chart.app_version}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `helm-charts-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 p-8 select-none">
          <Loader2 className="size-6 text-accent animate-spin" />
          <p className="text-[10px] text-zinc-500">Querying configured Helm repositories...</p>
        </div>
      ) : (
        <KubeWorkspaceLayout
          header={
            <HelmChartsToolbar
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
          <HelmChartsTable
            filteredData={filteredData}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectRow={handleSelectRow}
            onSelectChart={handleSelectChart}
            selectedChartName={selectedChartName}
            iconMap={iconMap}
          />
        </KubeWorkspaceLayout>
      )}
    </div>
  );
};

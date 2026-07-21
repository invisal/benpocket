import type React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { HelmReleasesToolbar } from './HelmReleasesToolbar';
import { HelmReleasesTable } from './HelmReleasesTable';
import { parseReleaseChart } from './parseReleaseChart';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { type HelmReleaseItem } from '../../../../../../preload/kuberneter/api';
import { Loader2, AlertCircle } from 'lucide-react';

function releaseKey(release: HelmReleaseItem): string {
  return `${release.namespace}/${release.name}`;
}

export const HelmReleases: React.FC = () => {
  const [releases, setReleases] = useState<HelmReleaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [namespaceFilter, setNamespaceFilter] = useState('All Namespaces');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedReleaseId =
    drawerState?.isOpen && drawerState?.contentType === 'helm-release'
      ? releaseKey(drawerState?.payload as HelmReleaseItem)
      : undefined;

  const handleSelectRelease = useCallback(
    (release: HelmReleaseItem) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'helm-release',
          payload: release
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  const activeCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const activeConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const fetchReleases = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;
      const res = await window.kuberneter.helmListReleases(
        configPathArg,
        activeCluster || undefined
      );

      if (res && 'error' in res) {
        setErrorMsg(res.error);
      } else if (Array.isArray(res)) {
        setReleases(res);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeConfigPath, activeCluster]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchReleases();
    });
  }, [fetchReleases]);

  // Distinct namespaces present in the releases, for the toolbar filter dropdown
  const namespaces = useMemo(() => {
    const set = new Set(releases.map((r) => r.namespace));
    return ['All Namespaces', ...Array.from(set).sort()];
  }, [releases]);

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return releases.filter((release) => {
      if (namespaceFilter !== 'All Namespaces' && release.namespace !== namespaceFilter) {
        return false;
      }

      if (!searchQuery) return true;

      const { name: chartName, version } = parseReleaseChart(release.chart);
      const fields = [
        release.name,
        release.namespace,
        chartName,
        version,
        release.app_version,
        release.status,
        release.revision
      ];

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
  }, [releases, namespaceFilter, searchQuery, caseSensitive, useRegex]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(filteredData.map((d) => releaseKey(d))) : new Set());
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
      selectedIds.size > 0
        ? filteredData.filter((d) => selectedIds.has(releaseKey(d)))
        : filteredData;

    if (dataToExport.length === 0) return;

    const headers = [
      'Name',
      'Namespace',
      'Chart',
      'Revision',
      'Version',
      'App Version',
      'Status',
      'Updated'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((release) => {
      const { name: chartName, version } = parseReleaseChart(release.chart);
      const row = [
        `"${release.name}"`,
        `"${release.namespace}"`,
        `"${chartName}"`,
        `"${release.revision}"`,
        `"${version}"`,
        `"${release.app_version}"`,
        `"${release.status}"`,
        `"${release.updated}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `helm-releases-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 p-8 select-none">
          <Loader2 className="size-6 text-accent animate-spin" />
          <p className="text-[10px] text-zinc-500">Listing installed Helm releases...</p>
        </div>
      )}

      {errorMsg && !isLoading && (
        <div className="shrink-0 flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-5">
          <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
          <div className="font-semibold break-all">
            <p>Error running helm command:</p>
            <p className="font-normal text-zinc-400 mt-1 font-mono text-[10px] bg-black/20 p-2 rounded border border-border-dark/30">
              {errorMsg}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !errorMsg && (
        <KubeWorkspaceLayout
          header={
            <HelmReleasesToolbar
              searchQuery={searchQuery}
              caseSensitive={caseSensitive}
              useRegex={useRegex}
              namespace={namespaceFilter}
              namespaces={namespaces}
              totalCount={filteredData.length}
              selectedCount={selectedIds.size}
              onSearchChange={setSearchQuery}
              onCaseSensitiveToggle={() => setCaseSensitive((v) => !v)}
              onRegexToggle={() => setUseRegex((v) => !v)}
              onNamespaceChange={setNamespaceFilter}
              onDownload={handleDownloadCsv}
            />
          }
        >
          <HelmReleasesTable
            filteredData={filteredData}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectRow={handleSelectRow}
            onSelectRelease={handleSelectRelease}
            onSelectNamespace={setNamespaceFilter}
            selectedReleaseId={selectedReleaseId}
          />
        </KubeWorkspaceLayout>
      )}
    </div>
  );
};

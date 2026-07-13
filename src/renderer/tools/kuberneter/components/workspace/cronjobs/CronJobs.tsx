import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type CronJobData } from '../../../types/CronJobData';
import { CronJobsToolbar } from './CronJobsToolbar';
import { CronJobsTable } from './CronJobsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface CronJobsProps {
  cronJobsData: CronJobData[];
  kuberneterSelectedNamespace: string;
}

export const CronJobs: React.FC<CronJobsProps> = ({
  cronJobsData,
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

  const selectedCronJobId =
    drawerState?.isOpen && drawerState?.contentType === 'cronjob'
      ? (drawerState?.payload as CronJobData)?.id
      : undefined;

  const handleSelectCronJob = useCallback(
    (cj: CronJobData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'cronjob',
          payload: cj
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  const filteredData = useMemo(() => {
    return cronJobsData.filter((cj) => {
      if (kuberneterSelectedNamespace !== 'All Namespaces' && cj.ns !== kuberneterSelectedNamespace)
        return false;

      if (!searchQuery) return true;

      const fields = [cj.name, cj.ns, cj.schedule, cj.timeZone, cj.age];

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
        return fields.some((f) => (caseSensitive ? f : f.toLowerCase()).includes(query));
      }
    });
  }, [cronJobsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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
      'Warning',
      'Namespace',
      'Schedule',
      'Suspend',
      'Active',
      'Last Schedule',
      'Next Execution',
      'Time Zone',
      'Age'
    ];
    const csvRows = [headers.join(',')];
    dataToExport.forEach((d) => {
      csvRows.push(
        [
          `"${d.name}"`,
          `"${d.hasWarning ? 'Warning' : 'OK'}"`,
          `"${d.ns}"`,
          `"${d.schedule}"`,
          d.suspend,
          d.active,
          `"${d.lastSchedule}"`,
          `"${d.nextExecution}"`,
          `"${d.timeZone}"`,
          `"${d.age}"`
        ].join(',')
      );
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cronjobs-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <CronJobsToolbar
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
      <CronJobsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectCronJob={handleSelectCronJob}
        selectedCronJobId={selectedCronJobId}
      />
    </KubeWorkspaceLayout>
  );
};

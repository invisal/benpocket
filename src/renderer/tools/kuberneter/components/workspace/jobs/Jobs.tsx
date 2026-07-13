import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type JobData } from '../../../types/JobData';
import { JobsToolbar } from './JobsToolbar';
import { JobsTable } from './JobsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface JobsProps {
  jobsData: JobData[];
  kuberneterSelectedNamespace: string;
}

export const Jobs: React.FC<JobsProps> = ({ jobsData, kuberneterSelectedNamespace }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedJobId =
    drawerState?.isOpen && drawerState?.contentType === 'job'
      ? (drawerState?.payload as JobData)?.id
      : undefined;

  const handleSelectJob = useCallback(
    (job: JobData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'job',
          payload: job
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  const filteredData = useMemo(() => {
    return jobsData.filter((job) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        job.ns !== kuberneterSelectedNamespace
      )
        return false;

      if (!searchQuery) return true;

      const fields = [job.name, job.ns, job.completions, job.conditions, job.age];

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
  }, [jobsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Warning', 'Namespace', 'Completions', 'Age', 'Conditions'];
    const csvRows = [headers.join(',')];
    dataToExport.forEach((d) => {
      csvRows.push(
        [
          `"${d.name}"`,
          `"${d.hasWarning ? 'Warning' : 'OK'}"`,
          `"${d.ns}"`,
          `"${d.completions}"`,
          `"${d.age}"`,
          `"${d.conditions}"`
        ].join(',')
      );
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jobs-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <JobsToolbar
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
      <JobsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectJob={handleSelectJob}
        selectedJobId={selectedJobId}
      />
    </KubeWorkspaceLayout>
  );
};

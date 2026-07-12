import React, { useState, useMemo, useCallback } from 'react';
import { CronJobData } from '../../../types/CronJobData';
import { CronJobsToolbar } from './CronJobsToolbar';
import { CronJobsTable } from './CronJobsTable';

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
  const [selectedCronJob, setSelectedCronJob] = useState<CronJobData | null>(null);

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
    <div className="flex-1 flex gap-4 min-h-0 min-w-0 py-4">
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 select-none">
        <div className="px-4">
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
        </div>
        <CronJobsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectCronJob={setSelectedCronJob}
          selectedCronJobId={selectedCronJob?.id}
        />
      </div>

      {selectedCronJob && (
        <div className="w-80 bg-sidebar-bg border border-border-dark rounded-lg p-4 flex flex-col gap-3.5 shrink-0 overflow-y-auto select-none animate-in slide-in-from-right duration-200 mr-4 mb-4 mt-0">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Cron Job Details
            </span>
            <button
              onClick={() => setSelectedCronJob(null)}
              className="text-zinc-555 hover:text-white cursor-pointer text-xs border-none bg-transparent"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Resource Name</span>
              <span className="font-mono text-zinc-200 break-all">{selectedCronJob.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
              <span className="font-mono text-zinc-300">{selectedCronJob.ns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Schedule</span>
              <span className="font-mono text-zinc-100 bg-surface-2 border border-border-dark/30 rounded px-2 py-1 mt-0.5">
                {selectedCronJob.schedule}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Status</span>
              <span className="font-mono text-zinc-300 border border-border-dark/30 rounded p-1.5 bg-surface-2 flex flex-col gap-1 mt-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Suspend:</span>
                  <span className={selectedCronJob.suspend ? 'text-amber-400' : 'text-emerald-400'}>
                    {selectedCronJob.suspend ? 'true' : 'false'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Active Jobs:</span>
                  <span>{selectedCronJob.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Last Schedule:</span>
                  <span>{selectedCronJob.lastSchedule}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Next Execution:</span>
                  <span>{selectedCronJob.nextExecution}</span>
                </div>
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Time Zone / Age</span>
              <span className="font-mono text-zinc-300">
                {selectedCronJob.timeZone} ({selectedCronJob.age})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

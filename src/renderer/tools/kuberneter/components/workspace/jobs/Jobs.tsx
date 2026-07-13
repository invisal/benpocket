import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type JobData } from '../../../types/JobData';
import { JobsToolbar } from './JobsToolbar';
import { JobsTable } from './JobsTable';

interface JobsProps {
  jobsData: JobData[];
  kuberneterSelectedNamespace: string;
}

export const Jobs: React.FC<JobsProps> = ({ jobsData, kuberneterSelectedNamespace }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null);

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
    <div className="flex-1 flex gap-4 min-h-0 min-w-0 py-4">
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 select-none">
        <div className="px-4">
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
        </div>
        <JobsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectJob={setSelectedJob}
          selectedJobId={selectedJob?.id}
        />
      </div>

      {selectedJob && (
        <div className="w-80 bg-sidebar-bg border border-border-dark rounded-lg p-4 flex flex-col gap-3.5 shrink-0 overflow-y-auto select-none animate-in slide-in-from-right duration-200 mr-4 mb-4 mt-0">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Job Details
            </span>
            <button
              onClick={() => setSelectedJob(null)}
              className="text-zinc-555 hover:text-white cursor-pointer text-xs border-none bg-transparent"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Resource Name</span>
              <span className="font-mono text-zinc-200 break-all">{selectedJob.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
              <span className="font-mono text-zinc-300">{selectedJob.ns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Completions</span>
              <span className="font-mono text-zinc-100 border border-border-dark/30 rounded p-1.5 bg-surface-2 flex flex-col gap-1 mt-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Desired:</span>
                  <span>{selectedJob.desired}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Succeeded:</span>
                  <span className="text-emerald-400">{selectedJob.succeeded}</span>
                </div>
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Conditions</span>
              <span className="font-mono text-zinc-300">{selectedJob.conditions}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Age</span>
              <span className="font-mono text-zinc-300">{selectedJob.age}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

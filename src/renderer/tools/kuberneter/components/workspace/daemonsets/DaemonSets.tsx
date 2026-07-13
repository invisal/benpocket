import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type DaemonSetData } from '../../../types/DaemonSetData';
import { DaemonSetsToolbar } from './DaemonSetsToolbar';
import { DaemonSetsTable } from './DaemonSetsTable';

interface DaemonSetsProps {
  daemonSetsData: DaemonSetData[];
  kuberneterSelectedNamespace: string;
}

export const DaemonSets: React.FC<DaemonSetsProps> = ({
  daemonSetsData,
  kuberneterSelectedNamespace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDaemonSet, setSelectedDaemonSet] = useState<DaemonSetData | null>(null);

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return daemonSetsData.filter((ds) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        ds.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [ds.name, ds.ns, ds.nodeSelector, ds.age];

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
  }, [daemonSetsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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
      'Desired',
      'Current',
      'Ready',
      'Up-to-Date',
      'Available',
      'Node Selector',
      'Age'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((d) => {
      const row = [
        `"${d.name}"`,
        `"${d.hasWarning ? 'Warning' : 'OK'}"`,
        `"${d.ns}"`,
        d.desired,
        d.current,
        d.ready,
        d.upToDate,
        d.available,
        `"${d.nodeSelector}"`,
        `"${d.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daemonsets-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex gap-4 min-h-0 min-w-0 py-4">
      {/* Table & Toolbar Container */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 select-none">
        <div className="px-4">
          <DaemonSetsToolbar
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
        <DaemonSetsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectDaemonSet={setSelectedDaemonSet}
          selectedDaemonSetId={selectedDaemonSet?.id}
        />
      </div>

      {/* Daemon Set details sliding side drawer panel */}
      {selectedDaemonSet && (
        <div className="w-80 bg-sidebar-bg border border-border-dark rounded-lg p-4 flex flex-col gap-3.5 shrink-0 overflow-y-auto select-none animate-in slide-in-from-right duration-200 mr-4 mb-4 mt-0">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Daemon Set Details
            </span>
            <button
              onClick={() => setSelectedDaemonSet(null)}
              className="text-zinc-550 hover:text-white cursor-pointer text-xs border-none bg-transparent"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Resource Name</span>
              <span className="font-mono text-zinc-200 break-all">{selectedDaemonSet.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
              <span className="font-mono text-zinc-300">{selectedDaemonSet.ns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Node Selector</span>
              <span className="font-mono text-zinc-350 bg-editor-bg px-2 py-1.5 rounded border border-border-dark/60 break-all select-text selection:bg-accent/30 selection:text-white leading-relaxed">
                {selectedDaemonSet.nodeSelector || 'N/A'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Scheduling Details</span>
              <span className="font-mono text-zinc-300">
                Desired: {selectedDaemonSet.desired} | Current: {selectedDaemonSet.current} | Ready:{' '}
                {selectedDaemonSet.ready}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Up-to-Date / Available</span>
              <span className="font-mono text-zinc-300">
                Up-to-Date: {selectedDaemonSet.upToDate} | Available: {selectedDaemonSet.available}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Warning State / Age</span>
              <span className="font-mono text-zinc-300">
                {selectedDaemonSet.hasWarning ? 'Warning' : 'OK'} ({selectedDaemonSet.age})
              </span>
            </div>
          </div>

          {/* Event Logs Drawer Mockup */}
          <div className="flex flex-col gap-1.5 mt-2 flex-1 border-t border-border-dark/60 pt-3">
            <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
            <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">45s ago</span>
                <span>Created pod for DaemonSet nodes</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">40s ago</span>
                <span>Successful scheduling on active nodes</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo, useCallback } from 'react';
import { ReplicaSetData } from '../../../types/ReplicaSetData';
import { ReplicaSetsToolbar } from './ReplicaSetsToolbar';
import { ReplicaSetsTable } from './ReplicaSetsTable';

interface ReplicaSetsProps {
  replicaSetsData: ReplicaSetData[];
  kuberneterSelectedNamespace: string;
}

export const ReplicaSets: React.FC<ReplicaSetsProps> = ({
  replicaSetsData,
  kuberneterSelectedNamespace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedReplicaSet, setSelectedReplicaSet] = useState<ReplicaSetData | null>(null);

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return replicaSetsData.filter((rs) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        rs.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        rs.name,
        rs.ns,
        rs.desired.toString(),
        rs.current.toString(),
        rs.ready.toString(),
        rs.age
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
  }, [replicaSetsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Warning', 'Namespace', 'Desired', 'Current', 'Ready', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((d) => {
      const row = [
        `"${d.name}"`,
        `"${d.hasWarning ? 'Warning' : 'OK'}"`,
        `"${d.ns}"`,
        d.desired,
        d.current,
        d.ready,
        `"${d.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `replicasets-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex gap-4 min-h-0 min-w-0 py-4">
      {/* Table & Toolbar Container */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 select-none">
        <div className="px-4">
          <ReplicaSetsToolbar
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
        <ReplicaSetsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectReplicaSet={setSelectedReplicaSet}
          selectedReplicaSetId={selectedReplicaSet?.id}
        />
      </div>

      {/* Details Panel Drawer */}
      {selectedReplicaSet && (
        <div className="w-80 bg-sidebar-bg border border-border-dark rounded-lg p-4 flex flex-col gap-3.5 shrink-0 overflow-y-auto select-none animate-in slide-in-from-right duration-200 mr-4 mb-4 mt-0">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Replica Set Details
            </span>
            <button
              onClick={() => setSelectedReplicaSet(null)}
              className="text-zinc-555 hover:text-white cursor-pointer text-xs border-none bg-transparent"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Resource Name</span>
              <span className="font-mono text-zinc-200 break-all">{selectedReplicaSet.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
              <span className="font-mono text-zinc-300">{selectedReplicaSet.ns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Desired / Current / Ready</span>
              <span className="font-mono text-zinc-300 border border-border-dark/30 rounded p-1.5 bg-surface-2 flex flex-col gap-1 mt-1">
                <div className="flex justify-between">
                  <span>Desired:</span>
                  <span className="text-zinc-100">{selectedReplicaSet.desired}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current:</span>
                  <span className="text-zinc-100">{selectedReplicaSet.current}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready:</span>
                  <span className="text-zinc-100">{selectedReplicaSet.ready}</span>
                </div>
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Warning State / Age</span>
              <span className="font-mono text-zinc-300">
                {selectedReplicaSet.hasWarning ? 'Warning (Replica mismatch)' : 'OK'} (
                {selectedReplicaSet.age})
              </span>
            </div>
          </div>

          {/* Event Logs Drawer Mockup */}
          <div className="flex flex-col gap-1.5 mt-2 flex-1 border-t border-border-dark/60 pt-3">
            <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
            <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">2m ago</span>
                <span>ReplicaSet scale evaluation complete</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">1m ago</span>
                <span>Replica counts matched expected state</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

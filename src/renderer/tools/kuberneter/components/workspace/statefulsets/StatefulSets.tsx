import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type StatefulSetData } from '../../../types/StatefulSetData';
import { StatefulSetsToolbar } from './StatefulSetsToolbar';
import { StatefulSetsTable } from './StatefulSetsTable';

interface StatefulSetsProps {
  statefulSetsData: StatefulSetData[];
  kuberneterSelectedNamespace: string;
}

export const StatefulSets: React.FC<StatefulSetsProps> = ({
  statefulSetsData,
  kuberneterSelectedNamespace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedStatefulSet, setSelectedStatefulSet] = useState<StatefulSetData | null>(null);

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return statefulSetsData.filter((ss) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        ss.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [ss.name, ss.ns, ss.ready, ss.age];

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
  }, [statefulSetsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Warning', 'Namespace', 'Pods', 'Replicas', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((d) => {
      const row = [
        `"${d.name}"`,
        `"${d.hasWarning ? 'Warning' : 'OK'}"`,
        `"${d.ns}"`,
        `"${d.ready}"`,
        d.replicas,
        `"${d.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statefulsets-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex gap-4 min-h-0 min-w-0 py-4">
      {/* Table & Toolbar Container */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 select-none">
        <div className="px-4">
          <StatefulSetsToolbar
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
        <StatefulSetsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectStatefulSet={setSelectedStatefulSet}
          selectedStatefulSetId={selectedStatefulSet?.id}
        />
      </div>

      {/* Stateful Set details sliding side drawer panel */}
      {selectedStatefulSet && (
        <div className="w-80 bg-sidebar-bg border border-border-dark rounded-lg p-4 flex flex-col gap-3.5 shrink-0 overflow-y-auto select-none animate-in slide-in-from-right duration-200 mr-4 mb-4 mt-0">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Stateful Set Details
            </span>
            <button
              onClick={() => setSelectedStatefulSet(null)}
              className="text-zinc-555 hover:text-white cursor-pointer text-xs border-none bg-transparent"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Resource Name</span>
              <span className="font-mono text-zinc-200 break-all">{selectedStatefulSet.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
              <span className="font-mono text-zinc-300">{selectedStatefulSet.ns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Pods / Replicas</span>
              <span className="font-mono text-zinc-300">
                Pods Status: {selectedStatefulSet.ready} (Total Replicas:{' '}
                {selectedStatefulSet.replicas})
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Warning State / Age</span>
              <span className="font-mono text-zinc-300">
                {selectedStatefulSet.hasWarning ? 'Warning' : 'OK'} ({selectedStatefulSet.age})
              </span>
            </div>
          </div>

          {/* Event Logs Drawer Mockup */}
          <div className="flex flex-col gap-1.5 mt-2 flex-1 border-t border-border-dark/60 pt-3">
            <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
            <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">1m ago</span>
                <span>StatefulSet replicas scale check successful</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">50s ago</span>
                <span>Active volume mount mapping confirmed</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

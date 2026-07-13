import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type PodData } from '../../../types/PodData';
import { PodsToolbar } from './PodsToolbar';
import { PodsTable } from './PodsTable';

interface PodsProps {
  podsData: PodData[];
  kuberneterSelectedNamespace: string;
}

export const Pods: React.FC<PodsProps> = ({ podsData, kuberneterSelectedNamespace }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPod, setSelectedPod] = useState<PodData | null>(null);

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return podsData.filter((pod) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        pod.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        pod.name,
        pod.ns,
        pod.status,
        pod.cpu,
        pod.memory,
        pod.controlledBy || '',
        pod.node || '',
        pod.qos || '',
        pod.age
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
  }, [podsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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
      'CPU',
      'Memory',
      'Restarts',
      'Controlled By',
      'Node',
      'QoS',
      'Status',
      'Age'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((p) => {
      const row = [
        `"${p.name}"`,
        `"${p.hasWarning ? 'Warning' : 'OK'}"`,
        `"${p.ns}"`,
        `"${p.cpu}"`,
        `"${p.memory}"`,
        p.restarts,
        `"${p.controlledBy || ''}"`,
        `"${p.node || ''}"`,
        `"${p.qos || ''}"`,
        `"${p.status}"`,
        `"${p.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pods-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex gap-4 min-h-0 min-w-0 py-4">
      {/* Table & Toolbar Container */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 select-none">
        <div className="px-4">
          <PodsToolbar
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
        <PodsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectPod={setSelectedPod}
          selectedPodId={selectedPod?.id}
        />
      </div>

      {/* Pod details sliding side drawer panel */}
      {selectedPod && (
        <div className="w-80 bg-sidebar-bg border border-border-dark rounded-lg p-4 flex flex-col gap-3.5 shrink-0 overflow-y-auto select-none animate-in slide-in-from-right duration-200 mr-4 mb-4 mt-0">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Pod Details
            </span>
            <button
              onClick={() => setSelectedPod(null)}
              className="text-zinc-550 hover:text-white cursor-pointer text-xs border-none bg-transparent"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-550 uppercase">Resource Name</span>
              <span className="font-mono text-zinc-200 break-all">{selectedPod.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-550 uppercase">Namespace</span>
              <span className="font-mono text-zinc-350">{selectedPod.ns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-550 uppercase">Controlled By</span>
              <span className="font-mono text-zinc-350">{selectedPod.controlledBy || '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Node Name</span>
              <span className="font-mono text-zinc-350">{selectedPod.node || '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">QoS Class</span>
              <span className="font-mono text-zinc-350">{selectedPod.qos || '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Status / Restarts</span>
              <span className="font-mono text-zinc-350">
                {selectedPod.status} ({selectedPod.restarts} restarts)
              </span>
            </div>
          </div>

          {/* Containers info section */}
          {selectedPod.containers.length > 0 && (
            <div className="flex flex-col gap-2.5 border-t border-border-dark/60 pt-3.5">
              <span className="text-[10px] font-bold text-zinc-455 uppercase">Containers</span>
              <div className="flex flex-col gap-2">
                {selectedPod.containers.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-300 truncate pr-2" title={c.name}>
                      {c.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        c.ready
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                          : 'bg-red-950/40 text-red-400 border-red-900/30'
                      }`}
                    >
                      {c.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event Logs Drawer Mockup */}
          <div className="flex flex-col gap-1.5 mt-2 flex-1 border-t border-border-dark/60 pt-3">
            <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
            <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">12s ago</span>
                <span>Scheduled pod to {selectedPod.node || 'minikube'}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">10s ago</span>
                <span>Successfully pulled container image</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">8s ago</span>
                <span>Created and started container</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Pods;

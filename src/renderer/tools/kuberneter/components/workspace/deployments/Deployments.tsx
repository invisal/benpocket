import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type DeployData } from '../../../types/DeployData';
import { DeploymentsToolbar } from './DeploymentsToolbar';
import { DeploymentsTable } from './DeploymentsTable';

interface DeploymentsProps {
  deploysData: DeployData[];
  kuberneterSelectedNamespace: string;
}

export const Deployments: React.FC<DeploymentsProps> = ({
  deploysData,
  kuberneterSelectedNamespace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDeploy, setSelectedDeploy] = useState<DeployData | null>(null);

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return deploysData.filter((deploy) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        deploy.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        deploy.name,
        deploy.ns,
        deploy.ready,
        deploy.status,
        deploy.age,
        deploy.strategy
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
  }, [deploysData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Warning', 'Namespace', 'Pods', 'Replicas', 'Age', 'Status'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((d) => {
      const row = [
        `"${d.name}"`,
        `"${d.hasWarning ? 'Warning' : 'OK'}"`,
        `"${d.ns}"`,
        `"${d.ready}"`,
        d.replicas,
        `"${d.age}"`,
        `"${d.status}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deployments-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex gap-4 min-h-0 min-w-0 py-4">
      {/* Table & Toolbar Container */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 select-none">
        <div className="px-4">
          <DeploymentsToolbar
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
        <DeploymentsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectDeploy={setSelectedDeploy}
          selectedDeployId={selectedDeploy?.id}
        />
      </div>

      {/* Deployment details sliding side drawer panel */}
      {selectedDeploy && (
        <div className="w-80 bg-sidebar-bg border border-border-dark rounded-lg p-4 flex flex-col gap-3.5 shrink-0 overflow-y-auto select-none animate-in slide-in-from-right duration-200 mr-4 mb-4 mt-0">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Deployment Details
            </span>
            <button
              onClick={() => setSelectedDeploy(null)}
              className="text-zinc-550 hover:text-white cursor-pointer text-xs border-none bg-transparent"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-550 uppercase">Resource Name</span>
              <span className="font-mono text-zinc-200 break-all">{selectedDeploy.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-550 uppercase">Namespace</span>
              <span className="font-mono text-zinc-300">{selectedDeploy.ns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Strategy Type</span>
              <span className="font-mono text-zinc-300">{selectedDeploy.strategy}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Replicas Details</span>
              <span className="font-mono text-zinc-300">
                Pods: {selectedDeploy.ready} (Available: {selectedDeploy.available}, Up-to-Date:{' '}
                {selectedDeploy.upToDate})
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Status / Age</span>
              <span className="font-mono text-zinc-300">
                {selectedDeploy.status} ({selectedDeploy.age})
              </span>
            </div>
          </div>

          {/* Event Logs Drawer Mockup */}
          <div className="flex flex-col gap-1.5 mt-2 flex-1 border-t border-border-dark/60 pt-3">
            <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
            <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">45s ago</span>
                <span>Deployment scaled to {selectedDeploy.replicas}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">40s ago</span>
                <span>Created replica set for generation 1</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">35s ago</span>
                <span>Scaled up replica set to {selectedDeploy.replicas}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Deployments;

import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { type PersistentVolumeClaimData } from '../../../types/PersistentVolumeClaimData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { parseK8sCapacity } from '../../../utils/formatCapacity';

interface PersistentVolumeClaimsTableProps {
  filteredData: PersistentVolumeClaimData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectPvc: (pvc: PersistentVolumeClaimData) => void;
  selectedPvcId?: string;
}

export const PersistentVolumeClaimsTable: React.FC<PersistentVolumeClaimsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectPvc,
  selectedPvcId
}) => {
  const { activeInstanceId, openTab } = useLayoutStore();
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  const handleNamespaceClick = (ns: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (ns && activeInstanceId) {
      setNamespace(activeInstanceId, ns);
    }
  };

  const handlePodClick = (podName: string, ns: string, e: React.MouseEvent) => {
    console.debug('Navigate to pod:', podName);
    e.stopPropagation();
    if (activeInstanceId) {
      setNamespace(activeInstanceId, ns);
      setKuberneterInstanceResource(activeInstanceId, 'pods');
      openTab({
        id: `kuberneter-k8s-pods-${activeInstanceId}`,
        title: `K8s Pods`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'pods' }
      });
    }
  };

  const columns = useMemo<Column<PersistentVolumeClaimData>[]>(
    () => [
      {
        key: 'select',
        header: (
          <input
            type="checkbox"
            checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="size-3 rounded border border-border-dark text-accent focus:ring-0 cursor-pointer accent-accent bg-surface-3"
          />
        ),
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={(e) => onSelectRow(row.id, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="size-3 rounded border border-border-dark text-accent focus:ring-0 cursor-pointer accent-accent bg-surface-3"
          />
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false,
        sortable: false
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <span
            className="font-mono text-zinc-300 font-semibold truncate hover:underline cursor-pointer"
            title={row.name}
          >
            {row.name}
          </span>
        ),
        className: 'font-mono text-zinc-300 max-w-[200px] truncate',
        initialWidth: 220
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => (
          <span
            onClick={(e) => handleNamespaceClick(row.ns, e)}
            className="font-mono text-accent hover:underline cursor-pointer"
          >
            {row.ns}
          </span>
        ),
        className: 'font-mono text-accent',
        initialWidth: 140
      },
      {
        key: 'storageClass',
        header: 'Storage class',
        render: (row) => (
          <span className="font-mono text-accent hover:underline cursor-pointer">
            {row.storageClass}
          </span>
        ),
        className: 'font-mono text-accent truncate max-w-[140px]',
        initialWidth: 140
      },
      {
        key: 'capacity',
        header: 'Size',
        sortValue: (row) => parseK8sCapacity(row.capacity),
        render: (row) => (
          <span className="text-zinc-300 font-mono text-[11px]">{row.capacity}</span>
        ),
        initialWidth: 100
      },
      {
        key: 'pods',
        header: 'Pods',
        render: (row) => {
          if (!row.pods || row.pods.length === 0) {
            return <span className="text-zinc-650 font-mono text-[11px]">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1 max-w-[180px] truncate">
              {row.pods.map((podName, idx) => (
                <span
                  key={podName}
                  onClick={(e) => handlePodClick(podName, row.ns, e)}
                  className="font-mono text-accent hover:underline cursor-pointer text-[11px]"
                  title={podName}
                >
                  {podName}
                  {idx < row.pods.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          );
        },
        initialWidth: 180
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => (
          <span className="text-zinc-500 font-mono text-[11px]">
            <Age
              timestamp={(row as unknown as Record<string, unknown>).creationTimestamp as string}
            />
          </span>
        ),
        className: 'text-zinc-500',
        initialWidth: 100
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => {
          const isBound = row.status === 'Bound';
          const isPending = row.status === 'Pending';
          return (
            <span
              className={`font-semibold text-[11px] ${
                isBound ? 'text-emerald-500' : isPending ? 'text-amber-500' : 'text-red-500'
              }`}
            >
              {row.status}
            </span>
          );
        },
        initialWidth: 100
      },
      {
        key: 'actions',
        header: (
          <div className="flex justify-center select-none">
            <MoreVertical className="size-3.5 text-zinc-555" />
          </div>
        ),
        render: () => (
          <div className="flex justify-center">
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-surface-3 text-zinc-500 hover:text-strong cursor-pointer border-none bg-transparent"
            >
              <MoreVertical className="size-3.5" />
            </button>
          </div>
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredData, selectedIds, onSelectAll, onSelectRow]
  );

  return (
    <KubeTable
      columns={columns}
      data={filteredData}
      getRowKey={(row) => row.id}
      className="flex-1"
      onRowClick={(row) => onSelectPvc(row)}
      selectedRowKey={selectedPvcId}
      emptyMessage="No Persistent Volume Claims match the search filters."
    />
  );
};

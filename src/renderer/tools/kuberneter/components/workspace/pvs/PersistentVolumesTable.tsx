import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { type PersistentVolumeData } from '../../../types/PersistentVolumeData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { parseK8sCapacity } from '../../../utils/formatCapacity';

interface PersistentVolumesTableProps {
  filteredData: PersistentVolumeData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectPv: (pv: PersistentVolumeData) => void;
  selectedPvId?: string;
}

export const PersistentVolumesTable: React.FC<PersistentVolumesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectPv,
  selectedPvId
}) => {
  const { activeInstanceId, openTab } = useLayoutStore();
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  const handleClaimClick = (claimName: string, ns: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.debug('Navigate to PVC claim:', claimName);
    if (activeInstanceId) {
      setNamespace(activeInstanceId, ns);
      setKuberneterInstanceResource(activeInstanceId, 'pvcs');
      openTab({
        id: `kuberneter-k8s-pvcs-${activeInstanceId}`,
        title: `K8s Persistent Volume Claims`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'pvcs' }
      });
    }
  };

  const columns = useMemo<Column<PersistentVolumeData>[]>(
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
        className: 'font-mono text-zinc-300 max-w-[240px] truncate',
        initialWidth: 260
      },
      {
        key: 'warning',
        header: (
          <div className="flex justify-center">
            <AlertTriangle className="size-3.5 text-zinc-500" />
          </div>
        ),
        render: (row) => {
          const hasWarning = row.status === 'Failed' || row.status === 'Lost';
          return (
            <div
              className="flex justify-center"
              title={hasWarning ? `PV has issue: ${row.status}` : undefined}
            >
              {hasWarning && <AlertTriangle className="size-3.5 text-amber-500 animate-pulse" />}
            </div>
          );
        },
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      },
      {
        key: 'storageClass',
        header: 'Storage Class',
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
        header: 'Capacity',
        sortValue: (row) => parseK8sCapacity(row.capacity),
        render: (row) => (
          <span className="text-zinc-300 font-mono text-[11px]">{row.capacity}</span>
        ),
        initialWidth: 100
      },
      {
        key: 'claim',
        header: 'Claim',
        render: (row) => {
          if (!row.claim) {
            return <span className="text-zinc-650 font-mono text-[11px]">—</span>;
          }
          return (
            <span
              onClick={(e) => handleClaimClick(row.claim!.name, row.claim!.namespace, e)}
              className="font-mono text-accent hover:underline cursor-pointer text-[11px] truncate max-w-[200px]"
              title={`${row.claim.namespace}/${row.claim.name}`}
            >
              {row.claim.name}
            </span>
          );
        },
        initialWidth: 200
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
          const isAvailable = row.status === 'Available';
          return (
            <span
              className={`font-semibold text-[11px] ${
                isBound || isAvailable ? 'text-emerald-500' : 'text-red-500'
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
      onRowClick={(row) => onSelectPv(row)}
      selectedRowKey={selectedPvId}
      emptyMessage="No Persistent Volumes match the search filters."
    />
  );
};

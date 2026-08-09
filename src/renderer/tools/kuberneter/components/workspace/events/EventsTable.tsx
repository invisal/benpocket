import type React from 'react';
import { useMemo, useCallback } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { Age } from '../../Age';
import { MoreVertical } from 'lucide-react';
import { type EventData } from '../../../types/EventData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';

interface EventsTableProps {
  filteredData: EventData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectEvent: (event: EventData) => void;
  selectedEventId?: string;
}

export const EventsTable: React.FC<EventsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectEvent,
  selectedEventId
}) => {
  const { activeInstanceId, openTab } = useLayoutStore();
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  const handleObjectClick = useCallback(
    (kind: string, name: string, ns: string, e: React.MouseEvent) => {
      e.stopPropagation();
      console.debug('Navigate to involved object:', kind, name, ns);

      const resourceMap: Record<string, string> = {
        Pod: 'pods',
        Service: 'services',
        Deployment: 'deployments',
        DaemonSet: 'daemonsets',
        StatefulSet: 'statefulsets',
        ReplicaSet: 'replicasets',
        Job: 'jobs',
        CronJob: 'cronjobs',
        ConfigMap: 'configmaps',
        Secret: 'secrets',
        PersistentVolumeClaim: 'pvcs',
        PersistentVolume: 'pvs',
        StorageClass: 'storageclasses',
        Namespace: 'namespaces'
      };

      const targetResource = resourceMap[kind];
      if (targetResource && activeInstanceId) {
        setNamespace(activeInstanceId, ns || 'All Namespaces');
        setKuberneterInstanceResource(activeInstanceId, targetResource);

        const labelMap: Record<string, string> = {
          pods: 'Pods',
          services: 'Services',
          deployments: 'Deployments',
          daemonsets: 'Daemon Sets',
          statefulsets: 'Stateful Sets',
          replicasets: 'Replica Sets',
          jobs: 'Jobs',
          cronjobs: 'Cron Jobs',
          configmaps: 'Config Maps',
          secrets: 'Secrets',
          pvcs: 'Persistent Volume Claims',
          pvs: 'Persistent Volumes',
          storageclasses: 'Storage Classes',
          namespaces: 'Namespaces'
        };

        openTab({
          id: `kuberneter-k8s-${targetResource}-${activeInstanceId}`,
          title: `K8s ${labelMap[targetResource] || targetResource}`,
          type: 'kuberneter',
          instanceId: activeInstanceId,
          meta: { resource: targetResource }
        });
      }
    },
    [activeInstanceId, setNamespace, setKuberneterInstanceResource, openTab]
  );

  const columns = useMemo<Column<EventData>[]>(
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
        key: 'type',
        header: 'Type',
        render: (row) => {
          const isWarning = row.type === 'Warning';
          return (
            <span className={isWarning ? 'text-amber-500 font-semibold' : 'text-zinc-400'}>
              {row.type}
            </span>
          );
        },
        className: 'text-[11px]',
        initialWidth: 80
      },
      {
        key: 'message',
        header: 'Message',
        render: (row) => {
          const isWarning = row.type === 'Warning';
          return (
            <span
              className={`truncate max-w-full inline-block ${isWarning ? 'text-amber-500/90 font-medium' : 'text-zinc-350'}`}
              title={row.message}
            >
              {row.message}
            </span>
          );
        },
        className: 'text-[11px] truncate max-w-[400px]',
        initialWidth: 420
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => <span className="text-zinc-450 font-mono text-[11px]">{row.ns}</span>,
        initialWidth: 100
      },
      {
        key: 'involvedObject',
        header: 'Involved Object',
        render: (row) => (
          <span
            onClick={(e) => handleObjectClick(row.involvedKind, row.involvedObject, row.ns, e)}
            className="font-mono text-accent hover:underline cursor-pointer text-[11px] truncate max-w-[200px]"
            title={`${row.involvedKind}: ${row.involvedObject}`}
          >
            {row.involvedKind}: {row.involvedObject}
          </span>
        ),
        initialWidth: 200
      },
      {
        key: 'source',
        header: 'Source',
        render: (row) => <span className="text-zinc-450 font-mono text-[11px]">{row.source}</span>,
        initialWidth: 140
      },
      {
        key: 'count',
        header: 'Count',
        render: (row) => <span className="text-zinc-400 text-[11px]">{row.count || 1}</span>,
        initialWidth: 80
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => (
          <span className="text-zinc-500 font-mono text-[11px]">
            <Age timestamp={row.creationTimestamp || ''} />
          </span>
        ),
        initialWidth: 80
      },
      {
        key: 'lastSeen',
        header: 'Last Seen',
        render: (row) => (
          <span className="text-zinc-500 font-mono text-[11px]">
            <Age timestamp={row.lastTimestamp || ''} />
          </span>
        ),
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
    [filteredData, selectedIds, onSelectAll, onSelectRow, handleObjectClick]
  );

  return (
    <KubeTable
      columns={columns}
      data={filteredData}
      getRowKey={(row) => row.id}
      className="flex-1"
      onRowClick={(row) => onSelectEvent(row)}
      selectedRowKey={selectedEventId}
      emptyMessage="No Events match the search filters."
    />
  );
};

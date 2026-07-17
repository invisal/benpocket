import type React from 'react';
import {
  type DeployData,
  type DeployRevision,
  type DeployRelatedPod
} from '../../../types/DeployData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface DeploymentDetailProps {
  payload: DeployData;
  isTab?: boolean;
}

interface DeployRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    replicas?: number;
    selector?: {
      matchLabels?: Record<string, string>;
    };
    strategy?: {
      type?: string;
    };
  };
  status?: {
    replicas?: number;
    updatedReplicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    unavailableReplicas?: number;
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export const DeploymentDetail: React.FC<DeploymentDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No deployment details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

  const rawItem = payload.rawItem as unknown as DeployRawResource | undefined;

  const labels = rawItem?.metadata?.labels ? Object.entries(rawItem.metadata.labels) : [];
  const annotations = rawItem?.metadata?.annotations
    ? Object.entries(rawItem.metadata.annotations)
    : [];

  // Created time formatted
  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : '';

  // Replicas breakdown
  const desired = rawItem?.spec?.replicas ?? 0;
  const updated = rawItem?.status?.updatedReplicas ?? 0;
  const total = rawItem?.status?.replicas ?? 0;
  const available = rawItem?.status?.availableReplicas ?? 0;
  const unavailable = rawItem?.status?.unavailableReplicas ?? 0;

  // Selector
  const selectorLabels = rawItem?.spec?.selector?.matchLabels
    ? Object.entries(rawItem.spec.selector.matchLabels)
    : [];
  const selectorStr = selectorLabels.map(([k, v]) => `${k}=${v}`).join(', ');

  // Conditions
  const conditions = rawItem?.status?.conditions || [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: `${payload.age} ago (${createdTime || 'N/A'})`
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer self-start"
        >
          {payload.ns}
        </span>
      )
    },
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Labels`,
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-300 break-all"
            >
              {k}: {v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <div
              key={k}
              className="font-mono text-[10px] text-zinc-400 bg-editor-bg px-2 py-1 rounded border border-border-dark/60 truncate"
              title={`${k}=${v}`}
            >
              {k}={v}
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'replicas',
      name: 'Replicas',
      value: `${desired} desired, ${updated} updated, ${total} total, ${available} available, ${unavailable} unavailable`
    },
    {
      id: 'selector',
      name: 'Selector',
      value:
        selectorLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectorLabels.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 border border-border/80 text-zinc-300"
              >
                {k}={v}
              </span>
            ))}
          </div>
        ) : (
          selectorStr || '—'
        )
    },
    {
      id: 'strategy',
      name: 'Strategy Type',
      value: payload.strategy
    },
    {
      id: 'status',
      name: 'Status',
      value: (
        <span
          className={`font-semibold ${
            payload.hasWarning ? 'text-amber-500 animate-pulse' : 'text-emerald-500'
          }`}
        >
          {payload.status}
        </span>
      )
    }
  ];

  if (conditions.length > 0) {
    propertiesData.push({
      id: 'conditions',
      name: 'Conditions',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((c) => {
            const isTrue = c.status === 'True';
            const isAvailable = c.type === 'Available';
            const badgeColor =
              isAvailable && isTrue
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                : isTrue
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'bg-zinc-800 border-border/85 text-zinc-400';
            return (
              <span
                key={c.type}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${badgeColor}`}
                title={c.message}
              >
                {c.type}
              </span>
            );
          })}
        </div>
      )
    });
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Metrics Section */}
      <div className="flex flex-col gap-2 bg-surface-2/40 border border-border/40 rounded-lg p-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
          <span>Metrics</span>
          <span className="text-zinc-500 font-normal">1h</span>
        </div>
        <div className="text-[10px] text-zinc-500">
          Displaying metrics from Prometheus:{' '}
          <span className="text-accent underline cursor-pointer">monitoring</span> /{' '}
          <span className="text-accent underline cursor-pointer">prometheus-operated:9090</span>
        </div>
        {/* Simple Premium Area Sparkline Mockup */}
        <div className="h-24 w-full bg-black/10 rounded border border-border-dark/30 relative flex flex-col justify-end p-1 select-none">
          <svg
            className="w-full h-full absolute inset-0 overflow-hidden"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 85 Q 20 60 40 85 T 80 50 T 120 70 T 160 40 T 200 65 T 240 30 T 280 55 T 320 80 T 360 40 L 400 40 L 400 100 L 0 100 Z"
              fill="url(#cpuGrad)"
              stroke="#3b82f6"
              strokeWidth="1.5"
            />
            {/* Highlighted metric bar */}
            <rect x="220" y="0" width="3" height="96" fill="#3b82f6" opacity="0.6" />
          </svg>
          <div className="absolute right-2 top-1 text-[9px] font-mono text-zinc-500 text-right">
            0.0008
            <br />
            0.0004
            <br />0
          </div>
          <div className="absolute left-2 top-2 text-[10px] font-mono text-zinc-400">CPU Usage</div>
        </div>
        <div className="flex justify-center items-center gap-1.5 text-[9px] font-mono text-zinc-500">
          <span className="size-1.5 rounded-full bg-blue-500"></span> CPU Usage
        </div>
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Deploy Revisions */}
      <div className="flex flex-col gap-2 mt-1 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
          Deploy Revisions
        </span>
        {!payload.revisions || payload.revisions.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No revisions found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<DeployRevision>
              columns={[
                {
                  key: 'revision',
                  header: '#',
                  className: 'py-2 px-3 text-zinc-200',
                  render: (row) => {
                    const index = payload.revisions?.findIndex((r) => r.name === row.name) ?? -1;
                    return (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1 h-3 rounded-sm ${index === 0 ? 'bg-emerald-500' : 'bg-zinc-650/60'}`}
                        ></span>
                        <span>{row.revision}</span>
                      </div>
                    );
                  }
                },
                {
                  key: 'name',
                  header: 'Summary',
                  className: 'py-2 px-3 text-zinc-400 truncate max-w-[200px]',
                  render: (row) => <span title={row.name}>{row.name}</span>
                },
                {
                  key: 'podsCount',
                  header: 'Pods',
                  className: 'py-2 px-3 text-zinc-300'
                },
                {
                  key: 'age',
                  header: 'Age',
                  className: 'py-2 px-3 text-zinc-450'
                },
                {
                  key: 'actions',
                  header: '',
                  className:
                    'py-2 px-3 text-center text-zinc-500 hover:text-zinc-300 cursor-pointer select-none',
                  render: () => '⋮'
                }
              ]}
              data={payload.revisions || []}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Pods Section */}
      <div className="flex flex-col gap-2 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Pods</span>
        {!payload.podsList || payload.podsList.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No pods found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<DeployRelatedPod>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'py-2 px-3 text-zinc-200 font-semibold truncate max-w-[180px]',
                  render: (row) => <span title={row.name}>{row.name}</span>
                },
                {
                  key: 'node',
                  header: 'Node',
                  className: 'py-2 px-3 text-zinc-300 truncate max-w-[100px]',
                  render: (row) => <span title={row.node}>{row.node}</span>
                },
                {
                  key: 'ns',
                  header: 'Namespace',
                  className: 'py-2 px-3 text-accent hover:underline cursor-pointer',
                  render: (row) => <span onClick={handleNamespaceClick}>{row.ns}</span>
                },
                {
                  key: 'ready',
                  header: 'Ready',
                  className: 'py-2 px-3 text-zinc-300'
                },
                {
                  key: 'cpu',
                  header: 'CPU',
                  className: 'py-2 px-3 text-zinc-300'
                },
                {
                  key: 'memory',
                  header: 'Memory',
                  className: 'py-2 px-3 text-zinc-300'
                },
                {
                  key: 'status',
                  header: 'Status',
                  className: 'py-2 px-3',
                  render: (row) => (
                    <span className={row.hasWarning ? 'text-rose-500' : 'text-emerald-500'}>
                      {row.status}
                    </span>
                  )
                },
                {
                  key: 'actions',
                  header: '',
                  className:
                    'py-2 px-3 text-center text-zinc-500 hover:text-zinc-300 cursor-pointer select-none',
                  render: () => '⋮'
                }
              ]}
              data={payload.podsList || []}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};

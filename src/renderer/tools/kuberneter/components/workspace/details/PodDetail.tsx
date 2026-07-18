import { Age } from '../../Age';
import type React from 'react';
import { useState } from 'react';
import { type PodData } from '../../../types/PodData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface PodDetailProps {
  payload: PodData;
  isTab?: boolean;
}

interface PodToleration {
  key?: string;
  operator?: string;
  effect?: string;
  tolerationSeconds?: number;
}

interface PodVolume {
  name: string;
  configMap?: { name: string };
  secret?: { secretName: string };
  persistentVolumeClaim?: { claimName: string };
  emptyDir?: Record<string, unknown>;
  hostPath?: { path: string };
}

interface PodCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

interface ContainerPort {
  containerPort: number;
  protocol: string;
}

interface ContainerEnvVar {
  name: string;
  value?: string;
}

interface ContainerVolumeMount {
  name: string;
  mountPath: string;
  readOnly?: boolean;
}

interface ContainerResourceRequirement {
  cpu?: string;
  memory?: string;
}

interface ContainerItem {
  name: string;
  image: string;
  imagePullPolicy: string;
  ports?: ContainerPort[];
  env?: ContainerEnvVar[];
  volumeMounts?: ContainerVolumeMount[];
  resources?: {
    requests?: ContainerResourceRequirement;
    limits?: ContainerResourceRequirement;
  };
}

interface ContainerStatusItem {
  name: string;
  ready: boolean;
  restartCount: number;
  state?: {
    running?: { startedAt: string };
    waiting?: { reason: string; message?: string };
    terminated?: { exitCode: number; reason: string; startedAt: string; finishedAt: string };
  };
  lastState?: {
    terminated?: { exitCode: number; reason: string; startedAt: string; finishedAt: string };
  };
}

interface PodRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    ownerReferences?: Array<{ kind: string; name: string }>;
  };
  spec?: {
    nodeName?: string;
    serviceAccountName?: string;
    tolerations?: PodToleration[];
    volumes?: PodVolume[];
    containers?: ContainerItem[];
  };
  status?: {
    phase?: string;
    podIP?: string;
    podIPs?: Array<{ ip: string }>;
    qosClass?: string;
    conditions?: PodCondition[];
    containerStatuses?: ContainerStatusItem[];
  };
}

export const PodDetail: React.FC<PodDetailProps> = ({ payload, isTab = false }) => {
  const [expandedContainers, setExpandedContainers] = useState<Set<string | number>>(new Set());

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No pod details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

  const rawItem = payload.rawItem as unknown as PodRawResource | undefined;

  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : '';

  const labels = rawItem?.metadata?.labels ? Object.entries(rawItem.metadata.labels) : [];
  const annotations = rawItem?.metadata?.annotations
    ? Object.entries(rawItem.metadata.annotations)
    : [];
  const tolerations = rawItem?.spec?.tolerations || [];
  const volumes = rawItem?.spec?.volumes || [];

  // Controlled By
  const ownerRef = rawItem?.metadata?.ownerReferences?.[0];
  const controlledByKind = ownerRef?.kind || '';
  const controlledByName = ownerRef?.name || '';

  // Node Name
  const nodeName = rawItem?.spec?.nodeName || '';

  // IPs
  const podIP = rawItem?.status?.podIP || '—';
  const podIPsArr = rawItem?.status?.podIPs || [];
  const podIPsStr = podIPsArr.map((ipObj) => ipObj.ip).join(', ') || podIP;

  // Service Account
  const serviceAccount = rawItem?.spec?.serviceAccountName || '—';

  // QoS Class
  const qosClass = rawItem?.status?.qosClass || '—';

  // Conditions
  const conditions = rawItem?.status?.conditions || [];

  // Containers
  const containers = rawItem?.spec?.containers || [];
  const containerStatuses = rawItem?.status?.containerStatuses || [];

  const handleContainerRowClick = (row: ContainerItem) => {
    setExpandedContainers((prev) => {
      const next = new Set(prev);
      if (next.has(row.name)) {
        next.delete(row.name);
      } else {
        next.add(row.name);
      }
      return next;
    });
  };

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />{' '}
          ago ({createdTime || 'N/A'})
        </span>
      )
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
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
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
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    }
  ];

  if (controlledByName) {
    propertiesData.push({
      id: 'controlledBy',
      name: 'Controlled By',
      value: (
        <span>
          {controlledByKind}{' '}
          <span className="text-accent hover:underline cursor-pointer">{controlledByName}</span>
        </span>
      )
    });
  }

  propertiesData.push({
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
  });

  if (nodeName) {
    propertiesData.push({
      id: 'node',
      name: 'Node',
      value: (
        <span className="font-mono text-accent hover:underline cursor-pointer self-start">
          {nodeName}
        </span>
      )
    });
  }

  propertiesData.push(
    {
      id: 'podIP',
      name: 'Pod IP',
      value: podIP
    },
    {
      id: 'podIPs',
      name: 'Pod IPs',
      value: podIPsStr
    },
    {
      id: 'serviceAccount',
      name: 'Service Account',
      value: (
        <span className="font-mono text-accent hover:underline cursor-pointer self-start">
          {serviceAccount}
        </span>
      )
    },
    {
      id: 'qosClass',
      name: 'QoS Class',
      value: qosClass
    }
  );

  const tolerationColumns = [
    {
      key: 'key',
      header: 'Key',
      className: 'font-mono text-zinc-300',
      render: (row: PodToleration) => row.key || '—'
    },
    {
      key: 'operator',
      header: 'Operator',
      className: 'font-mono text-zinc-400',
      render: (row: PodToleration) => row.operator || '—'
    },
    {
      key: 'effect',
      header: 'Effect',
      className: 'font-mono text-zinc-400',
      render: (row: PodToleration) => row.effect || '—'
    },
    {
      key: 'tolerationSeconds',
      header: 'Seconds',
      className: 'font-mono text-zinc-500',
      render: (row: PodToleration) =>
        row.tolerationSeconds !== undefined ? `${row.tolerationSeconds}s` : '—'
    }
  ];

  const volumeColumns = [
    {
      key: 'name',
      header: 'Name',
      className: 'font-mono text-zinc-300 font-semibold',
      render: (row: PodVolume) => row.name
    },
    {
      key: 'source',
      header: 'Source',
      className: 'font-mono text-zinc-400',
      render: (row: PodVolume) => {
        if (row.configMap) return `ConfigMap (${row.configMap.name})`;
        if (row.secret) return `Secret (${row.secret.secretName})`;
        if (row.persistentVolumeClaim) return `PVC (${row.persistentVolumeClaim.claimName})`;
        if (row.emptyDir) return 'EmptyDir';
        if (row.hostPath) return `HostPath (${row.hostPath.path})`;
        return '—';
      }
    }
  ];

  const conditionColumns = [
    {
      key: 'type',
      header: 'Type',
      className: 'font-mono text-zinc-300 font-semibold',
      render: (row: PodCondition) => row.type
    },
    {
      key: 'status',
      header: 'Status',
      className: 'font-mono',
      render: (row: PodCondition) => (
        <span
          className={
            row.status === 'True' ? 'text-emerald-500 font-semibold' : 'text-zinc-400 font-medium'
          }
        >
          {row.status}
        </span>
      )
    },
    {
      key: 'reason',
      header: 'Reason',
      className: 'font-mono text-zinc-400',
      render: (row: PodCondition) => row.reason || '—'
    },
    {
      key: 'message',
      header: 'Message',
      className: 'font-mono text-zinc-500 truncate max-w-[200px]',
      render: (row: PodCondition) => <span title={row.message}>{row.message || '—'}</span>
    }
  ];

  const containerColumns = [
    {
      key: 'name',
      header: 'Name',
      className: 'font-mono text-zinc-200 font-semibold truncate max-w-[120px]',
      render: (row: ContainerItem) => {
        const statusObj = containerStatuses.find((cs) => cs.name === row.name);
        const ready = !!statusObj?.ready;
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-sm ${ready ? 'bg-emerald-500' : 'bg-rose-500'}`}
            ></span>
            <span title={row.name}>{row.name}</span>
          </div>
        );
      }
    },
    {
      key: 'image',
      header: 'Image',
      className: 'font-mono text-zinc-400 truncate max-w-[180px]',
      render: (row: ContainerItem) => <span title={row.image}>{row.image}</span>
    },
    {
      key: 'status',
      header: 'Status',
      className: 'font-mono text-zinc-350',
      render: (row: ContainerItem) => {
        const statusObj = containerStatuses.find((cs) => cs.name === row.name);
        const ready = !!statusObj?.ready;
        let stateStr = 'waiting';
        if (statusObj?.state?.running) {
          stateStr = 'running';
        } else if (statusObj?.state?.terminated) {
          stateStr = 'terminated';
        } else if (statusObj?.state?.waiting) {
          stateStr = 'waiting';
        }
        return `${stateStr} (${ready ? 'ready' : 'not ready'})`;
      }
    },
    {
      key: 'restarts',
      header: 'Restarts',
      className: 'font-mono text-zinc-500',
      render: (row: ContainerItem) => {
        const statusObj = containerStatuses.find((cs) => cs.name === row.name);
        return statusObj?.restartCount ?? 0;
      }
    },
    {
      key: 'ports',
      header: 'Ports',
      className: 'font-mono text-accent',
      render: (row: ContainerItem) =>
        (row.ports || []).map((p) => `${p.containerPort}/${p.protocol}`).join(', ') || '—'
    }
  ];

  const renderContainerRowExpansion = (c: ContainerItem) => {
    const statusObj = containerStatuses.find((cs) => cs.name === c.name);
    const ready = !!statusObj?.ready;

    // Container state string
    let stateStr = 'waiting';
    let lastStateStr = '—';

    if (statusObj?.state?.running) {
      stateStr = 'running';
    } else if (statusObj?.state?.terminated) {
      stateStr = 'terminated';
    } else if (statusObj?.state?.waiting) {
      stateStr = 'waiting';
    }

    if (statusObj?.lastState?.terminated) {
      const ls = statusObj.lastState.terminated;
      lastStateStr = `terminated\nReason: ${ls.reason || 'Unknown'} - exit code: ${
        ls.exitCode
      }\nStarted at: ${
        ls.startedAt ? new Date(ls.startedAt).toLocaleString() : '—'
      }\nFinished at: ${ls.finishedAt ? new Date(ls.finishedAt).toLocaleString() : '—'}`;
    }

    // Env Vars
    const envVars = c.env || [];

    // Container ports
    const containerPorts =
      (c.ports || []).map((p) => `${p.containerPort}/${p.protocol}`).join(', ') || '—';

    // Limits / Requests
    const limits = c.resources?.limits || {};
    const requests = c.resources?.requests || {};

    // Mounts
    const mounts = c.volumeMounts || [];

    return (
      <div className="p-3 bg-zinc-950/45 border-t border-border/20 flex flex-col gap-3 w-full">
        {/* Sparkline chart for container */}
        <div className="h-20 w-full bg-black/10 rounded border border-border-dark/30 relative flex flex-col justify-end p-1 select-none">
          <svg
            className="w-full h-full absolute inset-0 overflow-hidden"
            preserveAspectRatio="none"
          >
            <path
              d="M 0 85 Q 20 65 40 80 T 80 50 T 120 70 T 160 40 T 200 65 T 240 30 T 280 55 T 320 80 T 360 40 L 400 40 L 400 100 L 0 100 Z"
              fill="url(#cpuGrad)"
              stroke="#10b981"
              strokeWidth="1.5"
            />
            <rect x="220" y="0" width="3" height="96" fill="#10b981" opacity="0.6" />
          </svg>
          <div className="absolute right-2 top-1 text-[9px] font-mono text-zinc-500 text-right">
            0.0008
            <br />
            0.0004
            <br />0
          </div>
          <div className="absolute left-2 top-2 text-[10px] font-mono text-zinc-455">
            Container CPU
          </div>
        </div>
        <div className="flex justify-center items-center gap-3 text-[9px] font-mono text-zinc-550">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500"></span> CPU Usage
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-lime-500"></span> CPU Requests
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-gray-600"></span> CPU Limits
          </span>
        </div>

        {/* Container detail grid */}
        <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Status</span>
            <span className={`font-semibold ${ready ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stateStr}, {ready ? 'ready' : 'not ready'}
            </span>
          </div>

          {lastStateStr !== '—' && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Last Status</span>
              <div className="font-mono text-[10px] text-zinc-400 bg-editor-bg p-2 rounded border border-border-dark/60 whitespace-pre-wrap select-text leading-4">
                {lastStateStr}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Image</span>
            <span className="font-mono text-zinc-300 break-all select-text">{c.image}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">ImagePullPolicy</span>
            <span className="font-mono text-zinc-300">{c.imagePullPolicy}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Ports</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-accent text-[11px]">{containerPorts}</span>
              {c.ports && c.ports.length > 0 && (
                <button className="px-2.5 py-1 text-[10px] bg-accent hover:bg-accent/80 text-white font-medium rounded border-none cursor-pointer select-none transition-colors">
                  Forward...
                </button>
              )}
            </div>
          </div>

          {/* Environment variables */}
          {envVars.length > 0 && (
            <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
              <span className="text-[10px] text-zinc-555 uppercase">
                Environment ({envVars.length} variables)
              </span>
              <div className="flex flex-col gap-1 mt-1 max-h-32 overflow-y-auto pr-1 select-text">
                {envVars.map((env) => (
                  <div
                    key={env.name}
                    className="font-mono text-[10px] text-zinc-400 bg-surface-3 px-2 py-1 rounded border border-border/60 truncate"
                    title={`${env.name}=${env.value || ''}`}
                  >
                    {env.name}: {env.value || '(valueFrom)'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Volume Mounts */}
          {mounts.length > 0 && (
            <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
              <span className="text-[10px] text-zinc-555 uppercase">Mounts</span>
              <div className="flex flex-col gap-1.5 mt-1 select-text max-h-32 overflow-y-auto pr-1">
                {mounts.map((m, idx) => (
                  <div
                    key={idx}
                    className="text-[10px] font-mono bg-surface-3 p-1.5 rounded border border-border/60 text-zinc-350 leading-4"
                  >
                    <div>{m.mountPath}</div>
                    <div className="text-[9px] text-zinc-500">
                      from {m.name} ({m.readOnly ? 'ro' : 'rw'})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 border-t border-border/20 pt-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Requests</span>
              <span className="font-mono text-zinc-300">
                CPU: {requests.cpu || '—'}, Memory: {requests.memory || '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Limits</span>
              <span className="font-mono text-zinc-300">
                CPU: {limits.cpu || '—'}, Memory: {limits.memory || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
              d="M 0 80 Q 20 40 40 70 T 80 50 T 120 75 T 160 30 T 200 60 T 240 20 T 280 65 T 320 85 T 360 40 L 400 40 L 400 100 L 0 100 Z"
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

      {/* Tolerations Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
          Tolerations
        </span>
        {tolerations.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No tolerations found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<PodToleration>
              columns={tolerationColumns}
              data={tolerations}
              getRowKey={(row) =>
                `${row.key || ''}-${row.operator || ''}-${row.effect || ''}-${row.tolerationSeconds || ''}`
              }
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Pod Volumes Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Pod Volumes
        </span>
        {volumes.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No volumes found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<PodVolume>
              columns={volumeColumns}
              data={volumes}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Conditions Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Conditions
        </span>
        {conditions.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No conditions found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<PodCondition>
              columns={conditionColumns}
              data={conditions}
              getRowKey={(row) => row.type}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Containers Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
          Containers
        </span>
        {containers.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No containers defined</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<ContainerItem>
              columns={containerColumns}
              data={containers}
              getRowKey={(row) => row.name}
              resizable={false}
              onRowClick={handleContainerRowClick}
              renderRowExpansion={renderContainerRowExpansion}
              expandedRowKeys={expandedContainers}
            />
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};

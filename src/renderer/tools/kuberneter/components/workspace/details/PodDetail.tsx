import type React from 'react';
import { useState } from 'react';
import { type PodData } from '../../../types/PodData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';

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
  const [labelsExpanded, setLabelsExpanded] = useState(false);
  const [annotationsExpanded, setAnnotationsExpanded] = useState(false);
  const [tolerationsExpanded, setTolerationsExpanded] = useState(false);
  const [volumesExpanded, setVolumesExpanded] = useState(false);

  // Keep track of which container environment variables are expanded
  const [expandedContainerEnv, setExpandedContainerEnv] = useState<Record<string, boolean>>({});

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

  const toggleContainerEnv = (cName: string) => {
    setExpandedContainerEnv((prev) => ({ ...prev, [cName]: !prev[cName] }));
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
        <div className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Created</span>
            <span className="font-mono text-zinc-300">
              {payload.age} ago ({createdTime || 'N/A'})
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Name</span>
            <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
            <span
              onClick={handleNamespaceClick}
              className="font-mono text-accent hover:underline cursor-pointer self-start"
            >
              {payload.ns}
            </span>
          </div>

          {/* Labels Collapsible */}
          <div className="flex flex-col gap-0.5">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setLabelsExpanded(!labelsExpanded)}
            >
              <span className="text-[10px] text-zinc-555 uppercase flex items-center gap-1">
                Labels
                <span className="text-[9px] text-zinc-650 font-normal">
                  {labelsExpanded ? '▲' : '▼'}
                </span>
              </span>
              <span className="text-xs text-zinc-400 font-medium">{labels.length} Labels</span>
            </div>
            {labelsExpanded && labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto pr-1">
                {labels.map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-300 break-all"
                  >
                    {k}: {v}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Annotations Collapsible */}
          <div className="flex flex-col gap-0.5">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setAnnotationsExpanded(!annotationsExpanded)}
            >
              <span className="text-[10px] text-zinc-555 uppercase flex items-center gap-1">
                Annotations
                <span className="text-[9px] text-zinc-650 font-normal">
                  {annotationsExpanded ? '▲' : '▼'}
                </span>
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                {annotations.length} Annotations
              </span>
            </div>
            {annotationsExpanded && annotations.length > 0 && (
              <div className="flex flex-col gap-1 mt-1.5 max-h-32 overflow-y-auto pr-1 select-text">
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
            )}
          </div>

          {controlledByName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Controlled By</span>
              <span className="font-mono text-zinc-300">
                {controlledByKind}{' '}
                <span className="text-accent hover:underline cursor-pointer">
                  {controlledByName}
                </span>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Status</span>
            <span
              className={`font-semibold ${
                payload.hasWarning ? 'text-amber-500 animate-pulse' : 'text-emerald-500'
              }`}
            >
              {payload.status}
            </span>
          </div>

          {nodeName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Node</span>
              <span className="font-mono text-accent hover:underline cursor-pointer self-start">
                {nodeName}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Pod IP</span>
            <span className="font-mono text-zinc-300">{podIP}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Pod IPs</span>
            <span className="font-mono text-zinc-300">{podIPsStr}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Service Account</span>
            <span className="font-mono text-accent hover:underline cursor-pointer self-start">
              {serviceAccount}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">QoS Class</span>
            <span className="font-mono text-zinc-300">{qosClass}</span>
          </div>

          {conditions.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Conditions</span>
              <div className="flex flex-wrap gap-1 mt-1 pr-1">
                {conditions.map((c) => (
                  <span
                    key={c.type}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                      c.status === 'True'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                        : 'bg-zinc-800 border-border/80 text-zinc-400'
                    }`}
                  >
                    {c.type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tolerations Collapsible */}
          <div className="flex flex-col gap-0.5">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setTolerationsExpanded(!tolerationsExpanded)}
            >
              <span className="text-[10px] text-zinc-555 uppercase flex items-center gap-1">
                Tolerations
                <span className="text-[9px] text-zinc-650 font-normal">
                  {tolerationsExpanded ? '▲' : '▼'}
                </span>
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                {tolerations.length} Tolerations
              </span>
            </div>
            {tolerationsExpanded && tolerations.length > 0 && (
              <div className="flex flex-col gap-1 mt-1.5 max-h-28 overflow-y-auto pr-1">
                {tolerations.map((t, idx) => (
                  <div
                    key={idx}
                    className="font-mono text-[10px] text-zinc-400 bg-surface-3 p-1.5 rounded border border-border/65"
                  >
                    {t.key ? `Key: ${t.key}` : ''} {t.operator ? `Operator: ${t.operator}` : ''}{' '}
                    {t.effect ? `Effect: ${t.effect}` : ''}{' '}
                    {t.tolerationSeconds ? `Seconds: ${t.tolerationSeconds}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pod Volumes */}
      <div className="flex flex-col gap-1.5 mt-1 border-t border-border-dark/60 pt-3">
        <div
          className="flex justify-between items-center cursor-pointer select-none"
          onClick={() => setVolumesExpanded(!volumesExpanded)}
        >
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider flex items-center gap-1">
            Pod Volumes
            <span className="text-[9px] text-zinc-650 font-normal">
              {volumesExpanded ? '▲' : '▼'}
            </span>
          </span>
          <span className="text-xs text-zinc-400 font-medium">{volumes.length} Volumes</span>
        </div>
        {volumesExpanded && volumes.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2 bg-surface-2/40 border border-border/40 rounded-lg p-3 text-xs text-zinc-350 pr-1">
            {volumes.map((v) => (
              <div
                key={v.name}
                className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5 last:border-0 last:pb-0"
              >
                <span className="font-mono text-zinc-200 font-semibold">{v.name}</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {v.configMap ? `ConfigMap: ${v.configMap.name}` : ''}
                  {v.secret ? `Secret: ${v.secret.secretName}` : ''}
                  {v.persistentVolumeClaim ? `PVC: ${v.persistentVolumeClaim.claimName}` : ''}
                  {v.emptyDir ? 'EmptyDir' : ''}
                  {v.hostPath ? `HostPath: ${v.hostPath.path}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Containers Section */}
      <div className="flex flex-col gap-4 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
          Containers
        </span>
        {containers.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No containers defined.</div>
        ) : (
          <div className="flex flex-col gap-5">
            {containers.map((c) => {
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
              const isEnvExpanded = !!expandedContainerEnv[c.name];

              // Container ports
              const containerPorts =
                (c.ports || []).map((p) => `${p.containerPort}/${p.protocol}`).join(', ') || '—';

              // Limits / Requests
              const limits = c.resources?.limits || {};
              const requests = c.resources?.requests || {};

              // Mounts
              const mounts = c.volumeMounts || [];

              return (
                <div key={c.name} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`size-2 rounded-sm ${ready ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    ></span>
                    <span className="font-mono text-zinc-150 font-bold text-xs">{c.name}</span>
                  </div>

                  {/* Sparkline chart for container */}
                  <div className="h-24 w-full bg-black/10 rounded border border-border-dark/30 relative flex flex-col justify-end p-1 select-none">
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
                  <div className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-zinc-555 uppercase">Status</span>
                      <span
                        className={`font-semibold ${ready ? 'text-emerald-500' : 'text-rose-500'}`}
                      >
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
                      <span className="font-mono text-zinc-300 break-all select-text">
                        {c.image}
                      </span>
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

                    {/* Environment variables Collapsible */}
                    <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
                      <div
                        className="flex justify-between items-center cursor-pointer select-none"
                        onClick={() => toggleContainerEnv(c.name)}
                      >
                        <span className="text-[10px] text-zinc-555 uppercase flex items-center gap-1">
                          Environment
                          <span className="text-[9px] text-zinc-650 font-normal">
                            {isEnvExpanded ? '▲' : '▼'}
                          </span>
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">
                          {envVars.length} variables
                        </span>
                      </div>
                      {isEnvExpanded && envVars.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1.5 max-h-32 overflow-y-auto pr-1 select-text">
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
                      )}
                    </div>

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
            })}
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

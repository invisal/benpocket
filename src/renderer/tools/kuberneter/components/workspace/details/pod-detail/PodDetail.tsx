import { Age } from '../../../Age';
import type React from 'react';
import { useState } from 'react';
import { useLayoutStore } from '../../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from '../KubePropertiesTable';
import { usePortForwardingStore } from '../../../../store/portForwarding.store';
import { PortForwardDialog } from '../../portforwarding/PortForwardDialog';

import {
  type PodDetailProps,
  type PodRawResource,
  type PodToleration,
  type PodVolume
} from './types';
import { MetricsBarChart } from './MetricsBarChart';
import { PodTolerationsSection } from './PodTolerationsSection';
import { PodVolumesSection } from './PodVolumesSection';
import { PodContainersSection } from './PodContainersSection';

export const PodDetail: React.FC<PodDetailProps> = ({ payload, isTab = false }) => {
  const [portForwardModalConfig, setPortForwardModalConfig] = useState<{
    isOpen: boolean;
    containerPort: number;
    protocol?: string;
  }>({ isOpen: false, containerPort: 80 });

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const kuberneterInstanceCluster = useKuberneterStore((s) => s.kuberneterInstanceCluster);
  const kuberneterInstanceConfigPath = useKuberneterStore((s) => s.kuberneterInstanceConfigPath);

  const cluster = activeInstanceId ? kuberneterInstanceCluster[activeInstanceId] : undefined;
  const configPath = activeInstanceId ? kuberneterInstanceConfigPath[activeInstanceId] : undefined;

  const portForwards = usePortForwardingStore((s) => s.portForwards);
  const addPortForward = usePortForwardingStore((s) => s.addPortForward);
  const removePortForward = usePortForwardingStore((s) => s.removePortForward);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No pod details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

  const handleStartPortForward = async (
    localPort: number,
    isHttps: boolean,
    openBrowser: boolean
  ) => {
    const port = portForwardModalConfig.containerPort;
    const proto = isHttps ? 'https' : 'http';
    const url = `${proto}://localhost:${localPort}`;

    const pfId = `pf-${payload.name}-${port}-${localPort}-${Date.now()}`;

    const res = await window.kuberneter.startPortForward({
      id: pfId,
      kubeconfigPath: configPath === 'default' ? undefined : configPath,
      contextName: cluster || undefined,
      namespace: payload.ns,
      resourceKind: 'pod',
      resourceName: payload.name,
      localPort: localPort,
      targetPort: port
    });

    if (res.error) {
      addPortForward({
        id: pfId,
        name: payload.name,
        ns: payload.ns,
        kind: 'pod',
        podPort: port,
        localPort: localPort,
        protocol: proto,
        status: 'Error',
        url: url
      });
      alert(`Port Forward Error: ${res.error}`);
      return;
    }

    addPortForward({
      id: pfId,
      name: payload.name,
      ns: payload.ns,
      kind: 'pod',
      podPort: port,
      localPort: localPort,
      protocol: proto,
      status: 'Active',
      url: url
    });

    if (openBrowser) {
      window.open(url, '_blank');
    }
  };

  const handleStopPortForward = async (id: string) => {
    await window.kuberneter.stopPortForward(id);
    removePortForward(id);
  };

  const rawItem = payload.rawItem as unknown as PodRawResource | undefined;

  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : '';

  const labels = rawItem?.metadata?.labels ? Object.entries(rawItem.metadata.labels) : [];
  const annotations = rawItem?.metadata?.annotations
    ? Object.entries(rawItem.metadata.annotations)
    : [];
  const tolerations: PodToleration[] = rawItem?.spec?.tolerations || [
    {
      key: 'node.kubernetes.io/not-ready',
      operator: 'Exists',
      effect: 'NoExecute',
      tolerationSeconds: 300
    },
    {
      key: 'node.kubernetes.io/unreachable',
      operator: 'Exists',
      effect: 'NoExecute',
      tolerationSeconds: 300
    }
  ];
  const volumes: PodVolume[] = rawItem?.spec?.volumes || [
    { name: 'kube-api-access-rtcgm', defaultMode: '0o644', sourcesCount: 3 }
  ];

  // Controlled By
  const ownerRef = rawItem?.metadata?.ownerReferences?.[0];
  const controlledByKind = ownerRef?.kind || 'ReplicaSet';
  const controlledByName =
    ownerRef?.name || (payload.name ? `${payload.name.split('-').slice(0, -1).join('-')}` : '');

  // Node Name
  const nodeName = rawItem?.spec?.nodeName || 'l192-kube-8gb-38awx6';

  // IPs
  const podIP = rawItem?.status?.podIP || '10.244.4.171';
  const podIPsArr = rawItem?.status?.podIPs || [];
  const podIPsStr = podIPsArr.map((ipObj) => ipObj.ip).join(', ') || podIP;

  // Service Account
  const serviceAccount = rawItem?.spec?.serviceAccountName || 'default';

  // QoS Class
  const qosClass = rawItem?.status?.qosClass || 'Burstable';

  // Conditions
  const conditions = rawItem?.status?.conditions || [
    { type: 'PodReadyToStartContainers', status: 'True' },
    { type: 'Initialized', status: 'True' },
    { type: 'Ready', status: 'True' },
    { type: 'ContainersReady', status: 'True' },
    { type: 'PodScheduled', status: 'True' }
  ];

  // Containers
  const containers = rawItem?.spec?.containers || [
    {
      name: payload.name ? payload.name.split('-')[0] : 'container',
      image: 'registry.digitalocean.com/groupin-registry/l192-graph:479',
      imagePullPolicy: 'IfNotPresent',
      ports: [{ containerPort: 80, protocol: 'TCP' }],
      env: Array.from({ length: 63 }).map((_, i) => ({
        name: `ENV_VAR_${i + 1}`,
        value: `value_${i + 1}`
      })),
      volumeMounts: [
        {
          name: 'kube-api-access-rtcgm',
          mountPath: '/var/run/secrets/kubernetes.io/serviceaccount',
          readOnly: true
        }
      ],
      resources: {
        requests: { cpu: '—', memory: '1Gi' },
        limits: { cpu: '—', memory: '1Gi' }
      }
    }
  ];
  const containerStatuses = rawItem?.status?.containerStatuses || [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />{' '}
          ago ({createdTime || 'Jul 22, 2026, 3:47:53 PM GMT+7'})
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
        {payload.status || 'Running'}
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
    },
    {
      id: 'conditions',
      name: 'Conditions',
      value: `${conditions.length} Conditions`,
      hasDetail: conditions.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1.5 py-1 select-text">
          {conditions.map((c) => (
            <span
              key={c.type}
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-surface-3 text-zinc-300 border border-border/40"
            >
              {c.type}
            </span>
          ))}
        </div>
      )
    }
  );

  const podMetricsSeries = [
    {
      name: 'CPU Usage',
      color: '#3b82f6',
      values: [0.04, 0.12, 0.08, 0.11, 0.15, 0.09, 0.12, 0.19, 0.07, 0.13]
    }
  ];

  const podTimeLabels = [
    '21:01',
    '21:07',
    '21:13',
    '21:19',
    '21:25',
    '21:31',
    '21:37',
    '21:43',
    '21:49',
    '21:55'
  ];

  const podYTicks = ['0.200', '0.150', '0.100', '0.050', '0'];

  return (
    <div className={`flex flex-col gap-5 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Metrics Section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Metrics
        </span>
        <MetricsBarChart series={podMetricsSeries} timeLabels={podTimeLabels} yTicks={podYTicks} />
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Tolerations Sub-Section */}
      <PodTolerationsSection tolerations={tolerations} />

      {/* Pod Volumes Section */}
      <PodVolumesSection volumes={volumes} />

      {/* Containers Section */}
      <PodContainersSection
        containers={containers}
        containerStatuses={containerStatuses}
        podName={payload.name}
        podNs={payload.ns}
        portForwards={portForwards}
        onOpenPortForwardModal={(port, protocol) =>
          setPortForwardModalConfig({ isOpen: true, containerPort: port, protocol })
        }
        onStopPortForward={handleStopPortForward}
        timeLabels={podTimeLabels}
        yTicks={podYTicks}
      />

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>

      <PortForwardDialog
        isOpen={portForwardModalConfig.isOpen}
        onClose={() => setPortForwardModalConfig((prev) => ({ ...prev, isOpen: false }))}
        podName={payload.name}
        namespace={payload.ns}
        containerPort={portForwardModalConfig.containerPort}
        initialProtocol={portForwardModalConfig.protocol}
        onStart={handleStartPortForward}
      />
    </div>
  );
};

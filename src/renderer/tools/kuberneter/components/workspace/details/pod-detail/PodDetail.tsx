import { Age } from '../../../Age';
import type React from 'react';
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
import { type K8sResource } from '../../../../types/K8sResource';
import { type PortForwardTunnelType } from '../../../../types/PortForwardData';
import { MetricsSection } from '../metrics';
import { PodTolerationsSection } from './PodTolerationsSection';
import { PodVolumesSection } from './PodVolumesSection';
import { PodContainersSection } from './PodContainersSection';
import {
  useOpenNamespaceDetail,
  useOpenNodeDetail,
  useOpenConfigDetail,
  useOpenResourceDetail
} from '../../../../hooks/open-detail';

export const PodDetail: React.FC<PodDetailProps> = ({ payload, isTab = false }) => {
  const [portForwardModalConfig, setPortForwardModalConfig] = useState<{
    isOpen: boolean;
    containerPort: number;
    protocol?: string;
  }>({ isOpen: false, containerPort: 80 });

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openNodeDetail } = useOpenNodeDetail();
  const { openServiceAccountDetail, openPriorityClassDetail, openRuntimeClassDetail } =
    useOpenConfigDetail();
  const { openResourceDetail } = useOpenResourceDetail();
  const kuberneterInstanceCluster = useKuberneterStore((s) => s.kuberneterInstanceCluster);
  const kuberneterInstanceConfigPath = useKuberneterStore((s) => s.kuberneterInstanceConfigPath);

  const cluster = activeInstanceId ? kuberneterInstanceCluster[activeInstanceId] : undefined;
  const configPath = activeInstanceId ? kuberneterInstanceConfigPath[activeInstanceId] : undefined;

  const portForwards = usePortForwardingStore((s) => s.portForwards);
  const addPortForward = usePortForwardingStore((s) => s.addPortForward);
  const removePortForward = usePortForwardingStore((s) => s.removePortForward);

  // Fetch full Pod data if needed and cache it to prevent reload flicker on tab switch
  const { data: fetchedPod } = useQuery<PodRawResource | null>({
    queryKey: ['kuberneter', 'pod-detail-raw', configPath, cluster, payload?.ns, payload?.name],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = configPath === 'default' ? undefined : configPath;
      try {
        const res = await window.kuberneter.getResources(
          configPathArg,
          cluster,
          'pods',
          payload.ns
        );
        const items = (res?.items || []) as K8sResource[];
        const match = items.find((i) => i.metadata?.name === payload.name);
        return (match as unknown as PodRawResource) || null;
      } catch (err) {
        console.warn('Failed to fetch pod in PodDetail:', err);
        return null;
      }
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-sm text-zinc-500">No pod details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns) {
      openNamespaceDetail(payload.ns);
    }
  };

  const handleStartPortForward = async (params: {
    localPort: number;
    openBrowser: boolean;
    tunnelType: PortForwardTunnelType;
  }) => {
    const { localPort, openBrowser, tunnelType } = params;
    const port = portForwardModalConfig.containerPort;
    const localUrl = `http://localhost:${localPort}`;

    const pfId = `pf-${payload.name}-${port}-${localPort}-${Date.now()}`;

    const res = await window.kuberneter.startPortForward({
      id: pfId,
      kubeconfigPath: configPath === 'default' ? undefined : configPath,
      contextName: cluster || undefined,
      namespace: payload.ns,
      resourceKind: 'pod',
      resourceName: payload.name,
      localPort: localPort,
      targetPort: port,
      kubectlPath: useKuberneterStore.getState().kuberneterKubectlPath || undefined,
      tunnelType
    });

    if (res.error) {
      addPortForward({
        id: pfId,
        name: payload.name,
        ns: payload.ns,
        kind: 'pod',
        podPort: port,
        localPort: localPort,
        protocol: 'http',
        tunnelType,
        status: 'Error',
        url: localUrl
      });

      const isKubectlMissing =
        res.error.includes('KUBECTL_NOT_FOUND') ||
        res.error.toLowerCase().includes('kubectl') ||
        res.error.toLowerCase().includes('enoent') ||
        res.error.toLowerCase().includes('not found');

      if (isKubectlMissing) {
        useKuberneterStore
          .getState()
          .showKubectlMissingToast(
            'Port Forwarding requires the kubectl CLI executable. Please configure kubectl in Settings.'
          );
      }
      return;
    }

    const activeUrl = res.publicUrl || localUrl;

    addPortForward({
      id: pfId,
      name: payload.name,
      ns: payload.ns,
      kind: 'pod',
      podPort: port,
      localPort: localPort,
      protocol: 'http',
      tunnelType,
      publicUrl: res.publicUrl,
      status: 'Active',
      url: activeUrl
    });

    if (openBrowser) {
      window.open(activeUrl, '_blank');
    }
  };

  const handleStopPortForward = async (id: string) => {
    await window.kuberneter.stopPortForward(id);
    removePortForward(id);
  };

  const rawItem = (fetchedPod || payload.rawItem) as unknown as PodRawResource | undefined;

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
  const volumes: PodVolume[] = rawItem?.spec?.volumes || [];

  // Controlled By
  const ownerRef = rawItem?.metadata?.ownerReferences?.[0];
  const controlledByKind = ownerRef?.kind || 'ReplicaSet';
  const controlledByName =
    ownerRef?.name || (payload.name ? `${payload.name.split('-').slice(0, -1).join('-')}` : '');

  // Node Name
  const nodeName = rawItem?.spec?.nodeName || '';

  // IPs
  const podIP = rawItem?.status?.podIP || '';
  const podIPsArr = rawItem?.status?.podIPs || [];
  const podIPsStr = podIPsArr.map((ipObj) => ipObj.ip).join(', ') || podIP || '—';

  // Service Account
  const serviceAccount = rawItem?.spec?.serviceAccountName || '';

  // QoS Class
  const qosClass = rawItem?.status?.qosClass || '—';

  // Conditions
  const conditions = rawItem?.status?.conditions || [];

  // Containers
  const containers = rawItem?.spec?.containers || [];
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
              title={`${k}={v}`}
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
              title={`${k}={v}`}
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
          <span
            onClick={() => openResourceDetail(controlledByKind, payload.ns, controlledByName)}
            className="text-accent hover:underline cursor-pointer font-mono"
          >
            {controlledByName}
          </span>
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
        <span
          onClick={() => openNodeDetail(nodeName)}
          className="font-mono text-accent hover:underline cursor-pointer self-start"
        >
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
        <span
          onClick={() => openServiceAccountDetail(payload.ns, serviceAccount)}
          className="font-mono text-accent hover:underline cursor-pointer self-start"
        >
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

  const priorityClassName = (rawItem?.spec as { priorityClassName?: string })?.priorityClassName;
  const runtimeClassName = (rawItem?.spec as { runtimeClassName?: string })?.runtimeClassName;

  if (priorityClassName) {
    propertiesData.push({
      id: 'priorityClass',
      name: 'Priority Class',
      value: (
        <span
          onClick={() => openPriorityClassDetail(priorityClassName)}
          className="font-mono text-accent hover:underline cursor-pointer self-start"
          title={`Open PriorityClass ${priorityClassName} in new tab`}
        >
          {priorityClassName}
        </span>
      )
    });
  }

  if (runtimeClassName) {
    propertiesData.push({
      id: 'runtimeClass',
      name: 'Runtime Class',
      value: (
        <span
          onClick={() => openRuntimeClassDetail(runtimeClassName)}
          className="font-mono text-accent hover:underline cursor-pointer self-start"
          title={`Open RuntimeClass ${runtimeClassName} in new tab`}
        >
          {runtimeClassName}
        </span>
      )
    });
  }

  propertiesData.push({
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
  });

  return (
    <div className={`flex flex-col gap-5 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Metrics Section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Metrics
        </span>
        <MetricsSection podName={payload.name} podNs={payload.ns} />
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
      <PodVolumesSection volumes={volumes} namespace={payload.ns} />

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
      />

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Events</span>
        <div className="text-sm text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>

      <PortForwardDialog
        isOpen={portForwardModalConfig.isOpen}
        onClose={() => setPortForwardModalConfig((prev) => ({ ...prev, isOpen: false }))}
        podName={payload.name}
        namespace={payload.ns}
        containerPort={portForwardModalConfig.containerPort}
        onStart={handleStartPortForward}
      />
    </div>
  );
};

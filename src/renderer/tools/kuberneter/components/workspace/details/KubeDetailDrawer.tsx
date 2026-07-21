import type React from 'react';
import { useRef, useEffect } from 'react';
import { Maximize2, Pencil, Star, Trash2, X, Terminal, Pause, RefreshCw } from 'lucide-react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { DetailContent } from './DetailContent';
import { type IngressClassData } from '../../../types/IngressClassData';

interface KubeDetailDrawerProps {
  tabId: string;
}

export const KubeDetailDrawer: React.FC<KubeDetailDrawerProps> = ({ tabId }) => {
  const { activeInstanceId, openTab } = useLayoutStore();
  const drawerState = useKuberneterStore((s) => s.kuberneterTabDrawers[tabId]);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);

  const drawerRef = useRef<HTMLDivElement>(null);
  const width = drawerState?.width ?? 320;
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
    if (drawerRef.current) {
      drawerRef.current.style.width = `${width}px`;
    }
  }, [width]);

  if (!drawerState || !drawerState.isOpen || !drawerState.contentType) {
    return null;
  }

  const { contentType, payload } = drawerState;

  const prefixMap: Record<string, string> = {
    pod: 'Pod',
    deployment: 'Deployment',
    daemonset: 'Daemon Set',
    statefulset: 'Stateful Set',
    replicaset: 'Replica Set',
    job: 'Job',
    cronjob: 'Cron Job',
    configmap: 'Config Map',
    secret: 'Secret',
    resourcequota: 'Resource Quota',
    limitrange: 'Limit Range',
    horizontalpodautoscaler: 'Horizontal Pod Autoscaler',
    hpa: 'Horizontal Pod Autoscaler',
    poddisruptionbudget: 'Pod Disruption Budget',
    pdb: 'Pod Disruption Budget',
    priorityclass: 'Priority Class',
    runtimeclass: 'Runtime Class',
    lease: 'Lease',
    service: 'Service',
    persistentvolumeclaim: 'Persistent Volume Claim',
    pvc: 'Persistent Volume Claim',
    persistentvolume: 'Persistent Volume',
    pv: 'Persistent Volume',
    storageclass: 'Storage Class',
    namespace: 'Namespace',
    clusterrole: 'Cluster Role',
    role: 'Role',
    clusterrolebinding: 'Cluster Role Binding',
    rolebinding: 'Role Binding',
    application: 'Application',
    app: 'Application',
    nodes: 'Node',
    node: 'Node',
    event: 'Event',
    endpointslice: 'Endpoint Slice',
    endpoints: 'Endpoints',
    endpoint: 'Endpoints',
    ingresses: 'Ingress',
    ingress: 'Ingress',
    ingressclasses: 'Ingress Class',
    ingressclass: 'Ingress Class',
    networkpolicies: 'Network Policy',
    networkpolicy: 'Network Policy',
    mutatingwebhook: 'Mutating Webhook',
    validatingwebhook: 'Validating Webhook',
    serviceaccount: 'Service Account',
    'helm-chart': 'Helm Chart',
    'helm-release': 'Helm Release'
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getResourceName = (data: any): string => {
    if (!data) return '';
    return (
      data.name ||
      data.metadata?.name ||
      data.instance ||
      data.releaseName ||
      data.chartName ||
      data.involvedObject ||
      data.reason ||
      data.id ||
      ''
    );
  };

  const resourceName = getResourceName(payload);
  const prefix = prefixMap[contentType] || contentType;
  const headerTitle = resourceName ? `${prefix}: ${resourceName}` : `${prefix}: Details`;

  const handleClose = () => {
    setDrawerState(tabId, { isOpen: false });
  };

  const handleMaximize = () => {
    if (!payload || !contentType) return;

    // Close drawer first
    setDrawerState(tabId, { isOpen: false });

    // Open new tab
    openTab({
      id: `kuberneter-${contentType}-detail-${resourceName || 'item'}-${activeInstanceId}`,
      title: headerTitle,
      type: 'kuberneter',
      instanceId: activeInstanceId,
      meta: {
        resource: `${contentType}-detail`,
        payload: payload
      }
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startWidth = widthRef.current;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const newWidth = Math.max(240, Math.min(startWidth + (startX - moveEvent.clientX), 800));
      widthRef.current = newWidth;
      if (drawerRef.current) {
        drawerRef.current.style.width = `${newWidth}px`;
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      try {
        (upEvent.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
      } catch {
        // Safe to ignore if target element doesn't support pointer capture
      }

      setDrawerState(tabId, { width: widthRef.current });
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      ref={drawerRef}
      style={{ width: `${width}px` }}
      className="absolute top-0 right-0 z-30 bg-surface-2 border-l border-border-dark flex flex-col h-full select-none shadow-2xl"
    >
      {/* Resize Handle on the left side of the drawer */}
      <div
        onPointerDown={handlePointerDown}
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-accent/40 active:bg-accent transition-colors z-40"
      />

      <div className="h-11 shrink-0 flex items-center gap-2 px-4 border-b border-border-dark min-w-0">
        <span
          className="text-xs font-bold text-white uppercase tracking-wider truncate min-w-0 flex-1"
          title={headerTitle}
        >
          {headerTitle}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {contentType === 'ingressclasses' && (
            <button
              title={`${(payload as IngressClassData).isDefault ? 'Remove default' : 'Set as default'}`}
              className="text-zinc-400 hover:text-yellow-400 cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
            >
              {(payload as IngressClassData).isDefault ? (
                <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
              ) : (
                <Star className="size-3.5" />
              )}
            </button>
          )}
          {contentType === 'nodes' && (
            <>
              <button
                title="Node Shell"
                className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Terminal className="size-3.5" />
              </button>
              <button
                title="Cordon Node"
                className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Pause className="size-3.5" />
              </button>
              <button
                title="Refresh"
                className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <RefreshCw className="size-3.5" />
              </button>
              <button
                title="Edit"
                className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                title="Delete"
                className="text-zinc-400 hover:text-red-400 cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
          {(contentType === 'ingressclasses' ||
            contentType === 'clusterrole' ||
            contentType === 'role' ||
            contentType === 'clusterrolebinding' ||
            contentType === 'rolebinding') && (
            <>
              <button
                title="Edit"
                className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                title="Delete"
                className="text-zinc-400 hover:text-red-400 cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
          <button
            onClick={handleMaximize}
            title="Open in new tab"
            className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            onClick={handleClose}
            title="Close drawer"
            className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 pr-5">
        <DetailContent
          key={`${contentType}-${resourceName}`}
          contentType={contentType}
          payload={payload}
        />
      </div>
    </div>
  );
};

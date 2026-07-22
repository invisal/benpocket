import type React from 'react';
import { useCallback } from 'react';
import { type PortForwardData } from '../../../types/PortForwardData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { cn } from 'cnfast';

interface PortForwardingDetailProps {
  payload: PortForwardData;
  isTab?: boolean;
}

function StatusValue({ status }: { status: PortForwardData['status'] }) {
  return (
    <span
      className={cn(
        'font-mono font-semibold',
        status === 'Active' && 'text-green-400',
        status === 'Stopped' && 'text-zinc-500',
        status === 'Error' && 'text-red-400'
      )}
    >
      {status}
    </span>
  );
}

export const PortForwardingDetail: React.FC<PortForwardingDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  const handleResourceClick = useCallback(() => {
    if (activeInstanceId && payload?.kind) {
      // Navigate to the relevant resource list
      const kindToResource: Record<string, string> = {
        pod: 'pods',
        pods: 'pods',
        deployment: 'deployments',
        deployments: 'deployments',
        service: 'services',
        services: 'services',
        statefulset: 'statefulsets',
        statefulsets: 'statefulsets',
        daemonset: 'daemonsets',
        daemonsets: 'daemonsets',
        replicaset: 'replicasets',
        replicasets: 'replicasets'
      };
      const resourceId = kindToResource[payload.kind.toLowerCase()];
      if (resourceId) {
        setResource(activeInstanceId, resourceId);
      }
    }
  }, [payload, activeInstanceId, setResource]);

  const propertiesData: PropertyItem[] = [
    {
      id: 'name',
      name: 'Resource Name',
      value: payload ? (
        <span
          onClick={handleResourceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {payload.name}
        </span>
      ) : (
        ''
      )
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: payload?.ns || ''
    },
    {
      id: 'kind',
      name: 'Kind',
      value: payload?.kind || ''
    },
    {
      id: 'podPort',
      name: 'Pod Port',
      value: payload ? String(payload.podPort) : ''
    },
    {
      id: 'localPort',
      name: 'Local Port',
      value: payload ? String(payload.localPort) : ''
    },
    {
      id: 'protocol',
      name: 'Protocol',
      value: payload?.protocol || ''
    },
    {
      id: 'status',
      name: 'Status',
      value: payload ? <StatusValue status={payload.status} /> : ''
    }
  ];

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Port Forward details available.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <KubePropertiesTable properties={propertiesData} />
      </div>
    </div>
  );
};

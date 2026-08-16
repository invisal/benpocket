import type React from 'react';
import { type EventData } from '../../../types/EventData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { Age } from '../../Age';

import { useOpenResourceDetail } from '../../../hooks/useOpenResourceDetail';

interface EventDetailProps {
  payload: EventData;
  isTab?: boolean;
}

export const EventDetail: React.FC<EventDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const openTab = useLayoutStore((s) => s.openTab);
  const { openNamespaceDetail } = useOpenResourceDetail();
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Event details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns) {
      openNamespaceDetail(payload.ns);
    }
  };

  const handleObjectClick = (kind: string, name: string, ns: string) => {
    console.debug('Navigate to object:', kind, name, ns);

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
  };

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age timestamp={payload.creationTimestamp || ''} /> ago
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
        <span onClick={handleNamespaceClick} className="text-accent hover:underline cursor-pointer">
          {payload.ns}
        </span>
      )
    },
    {
      id: 'message',
      name: 'Message',
      value: (
        <div className="whitespace-pre-wrap leading-relaxed select-text">{payload.message}</div>
      )
    },
    {
      id: 'reason',
      name: 'Reason',
      value: payload.reason || '—'
    },
    {
      id: 'source',
      name: 'Source',
      value: payload.source || '—'
    },
    {
      id: 'firstSeen',
      name: 'First seen',
      value: payload.firstTimestamp ? <Age timestamp={payload.firstTimestamp} /> : '—'
    },
    {
      id: 'lastSeen',
      name: 'Last seen',
      value: payload.lastTimestamp ? <Age timestamp={payload.lastTimestamp} /> : '—'
    },
    {
      id: 'count',
      name: 'Count',
      value: payload.count || '—'
    },
    {
      id: 'type',
      name: 'Type',
      value: (
        <span
          className={
            payload.type === 'Warning'
              ? 'text-amber-500 font-semibold'
              : 'text-zinc-400 font-semibold'
          }
        >
          {payload.type}
        </span>
      )
    }
  ];

  const objectProperties: PropertyItem[] = [
    {
      id: 'objName',
      name: 'Name',
      value: (
        <span
          onClick={() =>
            handleObjectClick(payload.involvedKind, payload.involvedObject, payload.ns)
          }
          className="text-accent hover:underline cursor-pointer font-mono"
        >
          {payload.involvedObject}
        </span>
      )
    },
    {
      id: 'objNamespace',
      name: 'Namespace',
      value: payload.involvedNamespace || payload.ns || '—'
    },
    {
      id: 'objKind',
      name: 'Kind',
      value: payload.involvedKind
    },
    {
      id: 'objFieldPath',
      name: 'Field Path',
      value: payload.involvedFieldPath || '—'
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Involved Object Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Involved object
        </span>
        <KubePropertiesTable properties={objectProperties} />
      </div>
    </div>
  );
};

import type React from 'react';
import { MetricsSection } from './MetricsSection';
import { type ContainerItem, type ContainerStatusItem } from './types';
import { type PortForwardData } from '../../../../types/PortForwardData';
import { KubePropertiesTable, type PropertyItem } from '../KubePropertiesTable';
import { Button } from '@renderer/components/ui/Button';

interface PodContainersSectionProps {
  containers: ContainerItem[];
  containerStatuses: ContainerStatusItem[];
  podName: string;
  podNs: string;
  portForwards: PortForwardData[];
  onOpenPortForwardModal: (port: number, protocol?: string) => void;
  onStopPortForward: (id: string) => void;
}

export const PodContainersSection: React.FC<PodContainersSectionProps> = ({
  containers,
  containerStatuses,
  podName,
  podNs,
  portForwards,
  onOpenPortForwardModal,
  onStopPortForward
}) => {
  return (
    <div className="flex flex-col gap-4 border-t border-border-dark/60 pt-3">
      <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
        Containers
      </span>

      {containers.map((c) => {
        const statusObj = containerStatuses.find((cs) => cs.name === c.name);
        const ready = statusObj ? statusObj.ready : true;
        const containerEnvVars = c.env || [];
        const mounts = c.volumeMounts || [];
        const limits = c.resources?.limits || {};
        const requests = c.resources?.requests || {};

        const containerProperties: PropertyItem[] = [
          {
            id: 'status',
            name: 'Status',
            value: (
              <span className={`font-semibold ${ready ? 'text-emerald-500' : 'text-rose-500'}`}>
                running, ready
              </span>
            )
          },
          {
            id: 'image',
            name: 'Image',
            value: <span className="font-mono text-zinc-300 break-all select-text">{c.image}</span>
          },
          {
            id: 'ports',
            name: 'Ports',
            value: (
              <div className="flex items-center justify-between w-full">
                {!c.ports || c.ports.length === 0 ? (
                  <span className="font-mono text-zinc-500 text-[11px]">—</span>
                ) : (
                  <div className="flex items-center gap-2">
                    {c.ports.map((p) => {
                      const activePf = portForwards.find(
                        (pf) =>
                          pf.name === podName &&
                          pf.ns === podNs &&
                          pf.podPort === p.containerPort &&
                          pf.status === 'Active'
                      );
                      return activePf ? (
                        <a
                          key={`${p.containerPort}-${p.protocol}`}
                          href={activePf.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-accent text-[11px] hover:underline"
                        >
                          {p.containerPort}/{p.protocol}
                        </a>
                      ) : (
                        <span
                          key={`${p.containerPort}-${p.protocol}`}
                          className="font-mono text-accent text-[11px]"
                        >
                          {p.containerPort}/{p.protocol}
                        </span>
                      );
                    })}
                  </div>
                )}
                {c.ports && c.ports.length > 0 && (
                  <div>
                    {c.ports.map((p) => {
                      const activePf = portForwards.find(
                        (pf) =>
                          pf.name === podName &&
                          pf.ns === podNs &&
                          pf.podPort === p.containerPort &&
                          pf.status === 'Active'
                      );
                      return activePf ? (
                        <Button
                          key={p.containerPort}
                          variant="primary"
                          size="sm"
                          onClick={() => onStopPortForward(activePf.id)}
                          className="h-6 px-2.5 py-0.5 text-[10px] font-medium bg-sky-600 hover:bg-sky-500 text-white"
                        >
                          Stop/Remove
                        </Button>
                      ) : (
                        <Button
                          key={p.containerPort}
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenPortForwardModal(p.containerPort, p.protocol)}
                        >
                          Forward...
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          },
          {
            id: 'environment',
            name: 'Environment',
            value: `${containerEnvVars.length} Environmental Variables`,
            hasDetail: containerEnvVars.length > 0,
            renderDetail: () => (
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto select-text pt-1 pr-1">
                {containerEnvVars.map((env) => (
                  <div
                    key={env.name}
                    className="font-mono text-[10px] text-zinc-350 bg-surface-3 px-2 py-1 rounded border border-border/60 truncate shrink-0"
                    title={`${env.name}=${env.value || ''}`}
                  >
                    {env.name}: {env.value || '(valueFrom)'}
                  </div>
                ))}
              </div>
            )
          },
          {
            id: 'mounts',
            name: 'Mounts',
            value: `${mounts.length} Mounts`,
            hasDetail: mounts.length > 0,
            renderDetail: () => (
              <div className="flex flex-col gap-1.5 font-mono text-[11px] text-zinc-350 select-text pt-1 pr-1 max-h-48 overflow-y-auto">
                {mounts.map((m, idx) => (
                  <div key={idx} className="shrink-0 leading-5">
                    <span className="bg-surface-3 px-1.5 py-0.5 rounded border border-border/40 text-zinc-300">
                      {m.mountPath}
                    </span>{' '}
                    <span className="text-zinc-500">
                      from {m.name} ({m.readOnly ? 'ro' : 'rw'})
                    </span>
                  </div>
                ))}
              </div>
            )
          },
          {
            id: 'requests',
            name: 'Requests',
            value: (
              <span className="font-mono text-zinc-300 text-[11px]">
                CPU: {requests.cpu || '—'}, Memory: {requests.memory || '1Gi'}
              </span>
            )
          },
          {
            id: 'limits',
            name: 'Limits',
            value: (
              <span className="font-mono text-zinc-300 text-[11px]">
                CPU: {limits.cpu || '—'}, Memory: {limits.memory || '1Gi'}
              </span>
            )
          }
        ];

        return (
          <div key={c.name} className="flex flex-col gap-3 pt-1">
            {/* Container Header */}
            <div className="flex items-center gap-2">
              <span className="size-2 bg-emerald-500 rounded-xs shrink-0" />
              <span className="font-mono text-sm font-semibold text-zinc-200">{c.name}</span>
            </div>

            {/* Container Prometheus Metrics Chart */}
            <MetricsSection podName={podName} podNs={podNs} />

            {/* Container Properties Table */}
            <KubePropertiesTable properties={containerProperties} />
          </div>
        );
      })}
    </div>
  );
};

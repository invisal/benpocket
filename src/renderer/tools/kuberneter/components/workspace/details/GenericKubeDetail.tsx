import type React from 'react';
import type { KubernetesObject } from '@kubernetes/client-node';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { Age } from '../../Age';
import { FileCode, Tag } from 'lucide-react';

interface GenericKubeDetailProps {
  payload: unknown;
  isTab?: boolean;
}

export const GenericKubeDetail: React.FC<GenericKubeDetailProps> = ({ payload }) => {
  const obj = (payload || {}) as KubernetesObject;
  const metadata = obj.metadata || {};

  const name = metadata.name || 'Unknown';
  const namespace = metadata.namespace || 'cluster-scoped';
  const kind = obj.kind || 'Resource';
  const apiVersion = obj.apiVersion || '';

  const properties: PropertyItem[] = [
    {
      id: 'name',
      name: 'Name',
      value: <span className="font-semibold text-zinc-100">{name}</span>
    },
    {
      id: 'kind',
      name: 'Kind',
      value: <span className="text-accent font-medium">{kind}</span>
    },
    {
      id: 'apiVersion',
      name: 'API Version',
      value: <span className="text-zinc-400 font-mono">{apiVersion}</span>
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: <span className="text-zinc-300">{namespace}</span>
    },
    {
      id: 'uid',
      name: 'UID',
      value: <span className="text-zinc-400 font-mono text-[10px]">{metadata.uid || '-'}</span>
    },
    {
      id: 'resourceVersion',
      name: 'Resource Version',
      value: (
        <span className="text-zinc-400 font-mono text-[10px]">
          {metadata.resourceVersion || '-'}
        </span>
      )
    },
    {
      id: 'age',
      name: 'Created',
      value: metadata.creationTimestamp ? (
        <span className="flex items-center gap-1">
          <Age timestamp={new Date(metadata.creationTimestamp).toISOString()} />
        </span>
      ) : (
        '-'
      )
    }
  ];

  const labels = metadata.labels ? Object.entries(metadata.labels) : [];
  const annotations = metadata.annotations ? Object.entries(metadata.annotations) : [];

  return (
    <div className="flex flex-col gap-4 p-4 text-xs font-sans text-zinc-300">
      {/* Properties Table */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          Metadata Overview
        </span>
        <KubePropertiesTable properties={properties} />
      </div>

      {/* Labels Section */}
      {labels.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Tag className="size-3 text-zinc-500" />
            Labels ({labels.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {labels.map(([k, v]) => (
              <span
                key={k}
                className="px-2 py-0.5 rounded bg-surface-2 border border-border-dark text-[10px] font-mono text-zinc-300"
              >
                <span className="text-accent">{k}</span>: {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Annotations Section */}
      {annotations.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <FileCode className="size-3 text-zinc-500" />
            Annotations ({annotations.length})
          </span>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {annotations.map(([k, v]) => (
              <div
                key={k}
                className="px-2.5 py-1 rounded bg-surface-2/60 border border-border-dark/50 text-[10px] font-mono flex flex-col gap-0.5"
              >
                <span className="text-zinc-400 font-semibold">{k}</span>
                <span className="text-zinc-300 break-all bg-black/20 p-1 rounded">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

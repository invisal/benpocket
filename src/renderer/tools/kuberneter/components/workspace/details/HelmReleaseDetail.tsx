import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Age } from '../../Age';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { parseReleaseChart } from '../helm-releases/parseReleaseChart';
import { parseHelmTimestamp } from '../helm-releases/parseHelmTimestamp';
import { type HelmReleaseItem } from '../../../../../../preload/kuberneter/api';
import { Loader2 } from 'lucide-react';

interface HelmReleaseDetailProps {
  payload: HelmReleaseItem;
  isTab?: boolean;
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'deployed') return 'text-emerald-500';
  if (s === 'failed') return 'text-red-500';
  if (s.startsWith('pending')) return 'text-amber-500';
  if (s === 'uninstalling') return 'text-amber-500';
  return 'text-zinc-400';
}

export const HelmReleaseDetail: React.FC<HelmReleaseDetailProps> = ({
  payload: release,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const activeConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const activeCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );

  const kubeconfigPath = activeConfigPath === 'default' ? undefined : activeConfigPath;

  const [values, setValues] = useState<string | null>(null);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [valuesError, setValuesError] = useState<string | null>(null);

  const fetchValues = useCallback(async () => {
    if (!release) return;
    setIsLoadingValues(true);
    setValuesError(null);
    try {
      const res = await window.kuberneter.helmGetReleaseValues(
        release.name,
        release.namespace,
        false,
        kubeconfigPath,
        activeCluster || undefined
      );
      if ('error' in res) {
        setValuesError(res.error);
      } else {
        setValues(res.values);
      }
    } catch (err) {
      setValuesError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingValues(false);
    }
  }, [release, kubeconfigPath, activeCluster]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchValues();
    });
  }, [fetchValues]);

  if (!release) {
    return <div className="p-4 text-xs text-zinc-500">No Helm Release details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (release.namespace && activeInstanceId) {
      setNamespace(activeInstanceId, release.namespace);
    }
  };

  const { name: chartName, version } = parseReleaseChart(release.chart);
  const updatedTimestamp = parseHelmTimestamp(release.updated);

  const propertiesData: PropertyItem[] = [
    {
      id: 'name',
      name: 'Name',
      value: release.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {release.namespace}
        </span>
      )
    },
    {
      id: 'chart',
      name: 'Chart',
      value: chartName
    },
    {
      id: 'chart-version',
      name: 'Chart Version',
      value: version || '—'
    },
    {
      id: 'app-version',
      name: 'App Version',
      value: release.app_version || '—'
    },
    {
      id: 'revision',
      name: 'Revision',
      value: release.revision
    },
    {
      id: 'status',
      name: 'Status',
      value: (
        <span className={`font-semibold capitalize ${statusColor(release.status)}`}>
          {release.status}
        </span>
      )
    },
    {
      id: 'updated',
      name: 'Updated',
      value: updatedTimestamp ? (
        <span>
          <Age timestamp={updatedTimestamp} /> ago ({release.updated})
        </span>
      ) : (
        release.updated
      )
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Values Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
          User-Supplied Values
        </span>
        {isLoadingValues ? (
          <div className="flex items-center gap-1.5 text-zinc-500 py-2 pl-1 text-[11px]">
            <Loader2 className="size-3.5 animate-spin text-accent" />
            <span>Loading release values...</span>
          </div>
        ) : valuesError ? (
          <p className="font-normal text-zinc-400 mt-1 font-mono text-[10px] bg-black/20 p-2 rounded border border-border-dark/30 select-text">
            {valuesError}
          </p>
        ) : values && values.trim() && values.trim() !== 'null' ? (
          <pre className="font-mono text-[11px] text-zinc-350 bg-black/20 p-3 rounded border border-border-dark/30 overflow-x-auto whitespace-pre select-text leading-relaxed">
            {values.trim()}
          </pre>
        ) : (
          <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">
            No user-supplied values (using chart defaults)
          </div>
        )}
      </div>
    </div>
  );
};

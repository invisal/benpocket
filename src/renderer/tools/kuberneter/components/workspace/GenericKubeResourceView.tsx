import type React from 'react';
import { useState, useEffect } from 'react';
import type { KubernetesObject } from '@kubernetes/client-node';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { KubeTable } from '../kube-table/KubeTable';
import type { Column } from '../kube-table/types';
import { ResourceView } from './ResourceView';
import { Age } from '../Age';

interface GenericKubeResourceViewProps {
  resource: string;
  kuberneterSelectedNamespace?: string;
}

export const GenericKubeResourceView: React.FC<GenericKubeResourceViewProps> = ({
  resource,
  kuberneterSelectedNamespace
}) => {
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const { kuberneterInstanceConfigPath, kuberneterInstanceCluster, setKuberneterTabDrawerState } =
    useKuberneterStore();

  const configPath = kuberneterInstanceConfigPath[activeInstanceId] || 'default';
  const cluster = kuberneterInstanceCluster[activeInstanceId] || '';

  const [items, setItems] = useState<KubernetesObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!cluster) return;

    let isMounted = true;
    const fetchResources = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const configPathArg = configPath === 'default' ? undefined : configPath;
        const res = await window.kuberneter.getResources(
          configPathArg,
          cluster,
          resource,
          kuberneterSelectedNamespace
        );
        if (!isMounted) return;
        if (res.error) {
          setErrorMsg(res.error);
        } else if (Array.isArray(res.items)) {
          setItems(res.items as KubernetesObject[]);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg((err as Error).message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchResources();
    return () => {
      isMounted = false;
    };
  }, [cluster, configPath, resource, kuberneterSelectedNamespace]);

  const handleOpenDrawer = (item: KubernetesObject) => {
    if (activeTabId) {
      setKuberneterTabDrawerState(activeTabId, {
        isOpen: true,
        contentType: item.kind?.toLowerCase() || resource,
        payload: item
      });
    }
  };

  const columns: Column<KubernetesObject>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (item) => item.metadata?.name || '',
      render: (item) => (
        <button
          onClick={() => handleOpenDrawer(item)}
          className="font-medium text-accent hover:underline text-left cursor-pointer"
        >
          {item.metadata?.name}
        </button>
      )
    },
    {
      key: 'namespace',
      header: 'Namespace',
      render: (item) => item.metadata?.namespace || 'cluster-scoped'
    },
    {
      key: 'apiVersion',
      header: 'API Version',
      render: (item) => item.apiVersion || '-'
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (item) => item.kind || '-'
    },
    {
      key: 'age',
      header: 'Age',
      sortValue: (item) => item.metadata?.creationTimestamp || '',
      render: (item) => (
        <Age
          timestamp={
            item.metadata?.creationTimestamp
              ? new Date(item.metadata.creationTimestamp).toISOString()
              : ''
          }
        />
      )
    }
  ];

  return (
    <ResourceView isLoading={isLoading} errorMsg={errorMsg}>
      <div className="flex-1 flex flex-col min-h-0 p-4">
        <KubeTable
          data={items}
          columns={columns}
          onRowClick={handleOpenDrawer}
          getRowKey={(row) => row.metadata?.uid || row.metadata?.name || Math.random()}
        />
      </div>
    </ResourceView>
  );
};

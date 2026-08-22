import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type IngressClassData } from '../../../types/IngressClassData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { KubeTable } from '../../kubeTable';
import {
  useOpenNamespaceDetail,
  useOpenNetworkDetail,
  useOpenResourceDetail
} from '../../../hooks/open-detail';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { buildIngressClassDetailPayload } from '../../../hooks/open-detail/transformers/network.transformer';

interface IngressClassDetailProps {
  payload: IngressClassData;
  isTab?: boolean;
}

interface IngressClassRelatedIngress {
  name: string;
  namespace: string;
  rules: string;
  ports: string;
  age: string;
  creationTimestamp: string;
}

export const IngressClassDetail: React.FC<IngressClassDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openIngressDetail } = useOpenNetworkDetail();
  const { openResourceDetail } = useOpenResourceDetail();

  // Live query for IngressClass and matching Ingresses
  const { data: queryData } = useQuery({
    queryKey: ['kuberneter', 'ingressclass-detail-data', rawConfigPath, cluster, payload?.name],
    queryFn: async () => {
      if (!cluster || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const [icRes, ingRes] = await Promise.all([
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.INGRESS_CLASSES),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.INGRESSES)
          .catch(() => ({ items: [] }))
      ]);

      const icItem = ((icRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allIngresses = (ingRes?.items || []) as K8sResource[];

      const ingressClassPayload = buildIngressClassDetailPayload(
        payload.name,
        icItem || (payload.rawItem as K8sResource)
      );

      // Find ingresses using this ingress class
      const matchingIngresses: IngressClassRelatedIngress[] = [];
      allIngresses.forEach((ing) => {
        const ingName = ing.metadata?.name || '';
        const ingNs = ing.metadata?.namespace || 'default';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawIng = ing as any;
        const ingClassName =
          rawIng?.spec?.ingressClassName ||
          rawIng?.metadata?.annotations?.['kubernetes.io/ingress.class'];

        if (ingClassName === payload.name) {
          const rules = rawIng?.spec?.rules || [];
          const ruleHosts = rules.map((r: { host?: string }) => r.host || '*').join(', ');
          matchingIngresses.push({
            name: ingName,
            namespace: ingNs,
            rules: ruleHosts || '—',
            ports: '80, 443',
            age: '',
            creationTimestamp: ing.metadata?.creationTimestamp || ''
          });
        }
      });

      return {
        ingressClassPayload,
        matchingIngresses
      };
    },
    enabled: !!cluster && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const currentData = queryData?.ingressClassPayload || payload;
  const matchingIngresses = queryData?.matchingIngresses || [];

  const annotations = currentData?.annotations ? Object.entries(currentData.annotations) : [];

  const creationTimestamp =
    currentData?.creationTimestamp ||
    (currentData as unknown as { rawItem?: { metadata?: { creationTimestamp?: string } } })?.rawItem
      ?.metadata?.creationTimestamp ||
    '';
  const createdTime =
    currentData?.createdTime ||
    (creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '') ||
    'N/A';

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          {creationTimestamp ? <Age timestamp={creationTimestamp} /> : currentData?.age || '—'} ago
          ({createdTime})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: currentData?.name || ''
    }
  ];

  if (currentData.isDefault) {
    propertiesData.push({
      id: 'isDefault',
      name: 'Default Class',
      value: <span className="font-semibold text-amber-400 font-mono">Yes</span>
    });
  }

  if (annotations.length > 0) {
    propertiesData.push({
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: true,
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
    });
  }

  propertiesData.push({
    id: 'controller',
    name: 'Controller',
    value: currentData?.controller || '—'
  });

  const parametersData: PropertyItem[] = useMemo(() => {
    const items: PropertyItem[] = [];
    if (currentData.parametersName) {
      items.push({
        id: 'parametersName',
        name: 'Name',
        value: (
          <span
            onClick={() =>
              openResourceDetail(
                currentData.parametersKind || 'IngressParameters',
                undefined as unknown as string,
                currentData.parametersName
              )
            }
            className="font-mono text-accent hover:underline cursor-pointer"
          >
            {currentData.parametersName}
          </span>
        )
      });
    } else {
      items.push({
        id: 'parametersName',
        name: 'Name',
        value: '—'
      });
    }

    items.push(
      {
        id: 'parametersScope',
        name: 'Scope',
        value: currentData.parametersScope || '—'
      },
      {
        id: 'parametersKind',
        name: 'Kind',
        value: currentData.parametersKind || '—'
      },
      {
        id: 'parametersApiGroup',
        name: 'API Group',
        value: currentData.parametersApiGroup || '—'
      }
    );
    return items;
  }, [currentData, openResourceDetail]);

  if (!payload) {
    return <div className="p-4 text-sm text-zinc-500">No IngressClass details available.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Parameters Section */}
      <div className="flex flex-col gap-2.5 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Parameters
        </span>
        <KubePropertiesTable properties={parametersData} />
      </div>

      {/* Ingresses Section */}
      {matchingIngresses.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            Ingresses ({matchingIngresses.length})
          </span>
          <div className="border-y border-border/40 flex flex-col h-auto max-h-[180px]">
            <KubeTable<IngressClassRelatedIngress>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'font-mono text-zinc-300 truncate max-w-[160px]',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openIngressDetail(row.namespace, row.name);
                      }}
                      className="text-accent hover:underline cursor-pointer"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )
                },
                {
                  key: 'namespace',
                  header: 'Namespace',
                  className: 'font-mono text-accent hover:underline cursor-pointer',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openNamespaceDetail(row.namespace);
                      }}
                    >
                      {row.namespace}
                    </span>
                  )
                },
                {
                  key: 'rules',
                  header: 'Rules',
                  className: 'font-mono text-zinc-400'
                },
                {
                  key: 'age',
                  header: 'Age',
                  className: 'font-mono text-zinc-500',
                  render: (row) => <Age timestamp={row.creationTimestamp} />
                }
              ]}
              data={matchingIngresses}
              getRowKey={(row) => `${row.namespace}/${row.name}`}
              resizable={false}
            />
          </div>
        </div>
      )}

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Events</span>
        <div className="text-sm text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};

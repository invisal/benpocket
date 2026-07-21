import { Age } from '../../Age';
import type React from 'react';
import { type RoleData } from '../../../types/RoleData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';

interface RoleDetailProps {
  payload: RoleData;
  isTab?: boolean;
}

export const RoleDetail: React.FC<RoleDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Role details available.</div>;
  }

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const labels = payload.labels ? Object.entries(payload.labels) : [];

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />{' '}
          ago ({((payload as unknown as Record<string, unknown>).createdTime as string) || 'N/A'})
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
          className="text-accent hover:underline cursor-pointer font-mono text-xs"
        >
          {payload.ns}
        </span>
      )
    }
  ];

  if (labels.length > 0) {
    propertiesData.push({
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Label${labels.length === 1 ? '' : 's'}`,
      hasDetail: true,
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
    });
  }

  if (annotations.length > 0) {
    propertiesData.push({
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotation${annotations.length === 1 ? '' : 's'}`,
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

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Rules Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Rules
        </span>
        {!payload.rules || payload.rules.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No rules defined</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {payload.rules.map((rule, idx) => {
              const showApiGroups = rule.apiGroups && rule.apiGroups.length > 0;
              const showResources = rule.resources && rule.resources.length > 0;
              const showVerbs = rule.verbs && rule.verbs.length > 0;
              const showResourceNames = rule.resourceNames && rule.resourceNames.length > 0;
              const showNonResourceUrls = rule.nonResourceURLs && rule.nonResourceURLs.length > 0;

              return (
                <div
                  key={idx}
                  className="bg-surface-2/40 border border-border/40 rounded-lg p-3.5 flex flex-col gap-1.5"
                >
                  <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 select-text">
                    {showResources && (
                      <>
                        <span className="text-zinc-500 text-right text-[11px] font-sans font-medium">
                          Resources
                        </span>
                        <span className="text-zinc-300 font-mono text-[11px] break-all leading-normal">
                          {rule.resources?.join(', ')}
                        </span>
                      </>
                    )}

                    {showVerbs && (
                      <>
                        <span className="text-zinc-500 text-right text-[11px] font-sans font-medium">
                          Verbs
                        </span>
                        <span className="text-zinc-300 font-mono text-[11px] break-all leading-normal">
                          {rule.verbs?.join(', ')}
                        </span>
                      </>
                    )}

                    {showApiGroups && (
                      <>
                        <span className="text-zinc-500 text-right text-[11px] font-sans font-medium">
                          Api Groups
                        </span>
                        <span className="text-zinc-300 font-mono text-[11px] break-all leading-normal">
                          {rule.apiGroups?.map((g) => (g === '' ? '""' : g)).join(', ')}
                        </span>
                      </>
                    )}

                    {showResourceNames && (
                      <>
                        <span className="text-zinc-500 text-right text-[11px] font-sans font-medium">
                          Resource Names
                        </span>
                        <span className="text-zinc-300 font-mono text-[11px] break-all leading-normal">
                          {rule.resourceNames?.join(', ')}
                        </span>
                      </>
                    )}

                    {showNonResourceUrls && (
                      <>
                        <span className="text-zinc-500 text-right text-[11px] font-sans font-medium">
                          Non-Resource URLs
                        </span>
                        <span className="text-zinc-300 font-mono text-[11px] break-all leading-normal">
                          {rule.nonResourceURLs?.join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};

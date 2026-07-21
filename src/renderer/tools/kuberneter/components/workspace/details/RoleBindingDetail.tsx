import { Age } from '../../Age';
import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type RoleBindingData } from '../../../types/RoleBindingData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import type { Column } from '../../kubeTable';

interface RoleBindingDetailProps {
  payload: RoleBindingData;
  isTab?: boolean;
}

interface SubjectTableRow {
  id: string;
  kind: string;
  name: string;
  namespace?: string;
}

export const RoleBindingDetail: React.FC<RoleBindingDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());

  const handleNamespaceClick = useCallback(
    (ns: string) => {
      if (ns && activeInstanceId) {
        setNamespace(activeInstanceId, ns);
      }
    },
    [activeInstanceId, setNamespace]
  );

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const labels = payload.labels ? Object.entries(payload.labels) : [];

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
          onClick={() => handleNamespaceClick(payload.ns)}
          className="text-accent hover:underline cursor-pointer font-mono text-xs"
        >
          {payload.ns}
        </span>
      )
    },
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Label${labels.length === 1 ? '' : 's'}`,
      hasDetail: labels.length > 0,
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
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotation${annotations.length === 1 ? '' : 's'}`,
      hasDetail: annotations.length > 0,
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
    }
  ];

  const referenceData: PropertyItem[] = [
    {
      id: 'kind',
      name: 'Kind',
      value: payload.roleRef?.kind || '—'
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.roleRef?.name || '—'
    },
    {
      id: 'apiGroup',
      name: 'API Group',
      value: payload.roleRef?.apiGroup || '—'
    }
  ];

  const subjectsData = useMemo<SubjectTableRow[]>(() => {
    const list = payload.subjects || [];
    return list.map((sub, idx) => ({
      id: `${sub.kind}-${sub.name}-${idx}`,
      kind: sub.kind,
      name: sub.name,
      namespace: sub.namespace
    }));
  }, [payload.subjects]);

  const handleSelectAllSubjects = useCallback(
    (checked: boolean) => {
      setSelectedSubjectIds(checked ? new Set(subjectsData.map((d) => d.id)) : new Set());
    },
    [subjectsData]
  );

  const handleSelectSubject = useCallback((id: string, checked: boolean) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const subjectsColumns = useMemo<Column<SubjectTableRow>[]>(
    () => [
      {
        key: 'select',
        header: (
          <input
            type="checkbox"
            checked={subjectsData.length > 0 && selectedSubjectIds.size === subjectsData.length}
            onChange={(e) => handleSelectAllSubjects(e.target.checked)}
            className="size-3 rounded border border-border-dark text-accent focus:ring-0 cursor-pointer accent-accent bg-surface-3"
          />
        ),
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedSubjectIds.has(row.id)}
            onChange={(e) => handleSelectSubject(row.id, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="size-3 rounded border border-border-dark text-accent focus:ring-0 cursor-pointer accent-accent bg-surface-3"
          />
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false,
        sortable: false
      },
      {
        key: 'kind',
        header: 'Type',
        render: (row) => <span className="text-zinc-300 font-sans text-xs">{row.kind}</span>,
        className: 'text-zinc-300 font-sans',
        initialWidth: 100
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <span className="text-zinc-300 font-sans text-xs truncate block" title={row.name}>
            {row.name}
          </span>
        ),
        className: 'text-zinc-300 font-sans truncate',
        initialWidth: 220
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => {
          if (!row.namespace) return <span className="text-zinc-500 font-sans text-xs">—</span>;
          return (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleNamespaceClick(row.namespace!);
              }}
              className="text-accent hover:underline cursor-pointer font-sans text-xs"
            >
              {row.namespace}
            </span>
          );
        },
        className: 'text-zinc-300 font-sans truncate',
        initialWidth: 140
      }
    ],
    [
      subjectsData,
      selectedSubjectIds,
      handleSelectAllSubjects,
      handleSelectSubject,
      handleNamespaceClick
    ]
  );

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Reference Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Reference
        </span>
        <KubePropertiesTable properties={referenceData} />
      </div>

      {/* Bindings Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-2">
          Bindings
        </span>
        {subjectsData.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No bindings defined</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-55">
            <KubeTable<SubjectTableRow>
              columns={subjectsColumns}
              data={subjectsData}
              getRowKey={(row) => row.id}
              resizable={false}
            />
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

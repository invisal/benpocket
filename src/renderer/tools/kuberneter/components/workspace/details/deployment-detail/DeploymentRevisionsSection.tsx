import { memo, type FC } from 'react';
import { Age } from '../../../Age';
import { KubeTable } from '../../../kubeTable';
import type { DeployRevision } from '../../../../types/DeployData';
import type { K8sResource } from '../../../../types/K8sResource';

interface DeploymentRevisionsSectionProps {
  revisions: DeployRevision[];
  namespace: string;
  onOpenReplicaSetDetail: (ns: string, name: string, rawItem?: K8sResource) => void;
}

export const DeploymentRevisionsSection: FC<DeploymentRevisionsSectionProps> = memo(
  function DeploymentRevisionsSection({
    revisions,
    namespace,
    onOpenReplicaSetDetail
  }: DeploymentRevisionsSectionProps) {
    return (
      <div className="flex flex-col gap-2 mt-1 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
          Deploy Revisions
        </span>
        {revisions.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No revisions found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<DeployRevision>
              columns={[
                {
                  key: 'revision',
                  header: '#',
                  className: 'py-2 px-3 text-zinc-200',
                  render: (row) => {
                    const index = revisions.findIndex((r) => r.name === row.name);
                    return (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1 h-3 rounded-sm ${index === 0 ? 'bg-emerald-500' : 'bg-zinc-650/60'}`}
                        ></span>
                        <span>{row.revision}</span>
                      </div>
                    );
                  }
                },
                {
                  key: 'name',
                  header: 'Summary',
                  className: 'py-2 px-3 text-zinc-400 truncate max-w-[200px]',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenReplicaSetDetail(
                          namespace,
                          row.name,
                          (row as unknown as { rawItem?: K8sResource }).rawItem
                        );
                      }}
                      className="text-accent hover:underline cursor-pointer font-mono"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )
                },
                {
                  key: 'podsCount',
                  header: 'Pods',
                  className: 'py-2 px-3 text-zinc-300'
                },
                {
                  key: 'age',
                  header: 'Age',
                  className: 'py-2 px-3 text-zinc-450',
                  render: (row) => (
                    <Age
                      timestamp={
                        (row as unknown as Record<string, unknown>).creationTimestamp as string
                      }
                    />
                  )
                },
                {
                  key: 'actions',
                  header: '',
                  className:
                    'py-2 px-3 text-center text-zinc-500 hover:text-zinc-300 cursor-pointer select-none',
                  render: () => '⋮'
                }
              ]}
              data={revisions}
              getRowKey={(row) => row.name}
              onRowClick={(row) =>
                onOpenReplicaSetDetail(
                  namespace,
                  row.name,
                  (row as unknown as { rawItem?: K8sResource }).rawItem
                )
              }
              resizable={false}
            />
          </div>
        )}
      </div>
    );
  }
);

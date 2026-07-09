import React from 'react';

interface DeploymentsTableProps {
  deploysData: Array<{
    name: string;
    ns: string;
    ready: string;
    upToDate: number;
    available: number;
    age: string;
  }>;
  kuberneterSelectedNamespace: string;
}

export const DeploymentsTable: React.FC<DeploymentsTableProps> = ({
  deploysData,
  kuberneterSelectedNamespace
}) => {
  return (
    <div className="bg-sidebar-bg border border-border-dark rounded-lg overflow-hidden select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-editor-bg border-b border-border-dark text-zinc-455 text-[10px] font-bold uppercase tracking-wider">
              <th className="p-3">Name</th>
              <th className="p-3">Namespace</th>
              <th className="p-3">Ready</th>
              <th className="p-3">Up-To-Date</th>
              <th className="p-3">Available</th>
              <th className="p-3">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark/60 text-zinc-300">
            {deploysData
              .filter(
                (d) =>
                  kuberneterSelectedNamespace === 'All Namespaces' ||
                  d.ns === kuberneterSelectedNamespace
              )
              .map((deploy, i) => (
                <tr key={i} className="hover:bg-editor-bg/40 transition-colors">
                  <td className="p-3 font-mono font-semibold text-zinc-200">{deploy.name}</td>
                  <td className="p-3 font-mono text-[10px] text-zinc-500">{deploy.ns}</td>
                  <td className="p-3 font-mono">{deploy.ready}</td>
                  <td className="p-3 font-mono">{deploy.upToDate}</td>
                  <td className="p-3 font-mono text-emerald-400 font-semibold">
                    {deploy.available}
                  </td>
                  <td className="p-3 text-zinc-500">{deploy.age}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

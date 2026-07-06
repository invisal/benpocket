import React from 'react';

interface ConfigMapsTableProps {
  configMapsData: Array<{
    name: string;
    ns: string;
    keys: number;
    age: string;
  }>;
  lensSelectedNamespace: string;
}

export const ConfigMapsTable: React.FC<ConfigMapsTableProps> = ({
  configMapsData,
  lensSelectedNamespace
}) => {
  return (
    <div className="bg-sidebar-bg border border-border-dark rounded-lg overflow-hidden select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-editor-bg border-b border-border-dark text-zinc-455 text-[10px] font-bold uppercase tracking-wider">
              <th className="p-3">Name</th>
              <th className="p-3">Namespace</th>
              <th className="p-3 text-center">Data Keys</th>
              <th className="p-3">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark/60 text-zinc-300">
            {configMapsData
              .filter(
                (c) => lensSelectedNamespace === 'All Namespaces' || c.ns === lensSelectedNamespace
              )
              .map((cm, i) => (
                <tr key={i} className="hover:bg-editor-bg/40 transition-colors">
                  <td className="p-3 font-mono text-zinc-200">{cm.name}</td>
                  <td className="p-3 font-mono text-[10px] text-zinc-500">{cm.ns}</td>
                  <td className="p-3 text-center font-mono font-bold text-accent">{cm.keys}</td>
                  <td className="p-3 text-zinc-500">{cm.age}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

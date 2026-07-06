import React from 'react';

interface ServicesTableProps {
  servicesData: Array<{
    name: string;
    ns: string;
    type: string;
    clusterIp: string;
    ports: string;
    age: string;
  }>;
  lensSelectedNamespace: string;
}

export const ServicesTable: React.FC<ServicesTableProps> = ({
  servicesData,
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
              <th className="p-3">Type</th>
              <th className="p-3">Cluster IP</th>
              <th className="p-3">Ports</th>
              <th className="p-3">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark/60 text-zinc-300">
            {servicesData
              .filter(
                (s) => lensSelectedNamespace === 'All Namespaces' || s.ns === lensSelectedNamespace
              )
              .map((svc, i) => (
                <tr key={i} className="hover:bg-editor-bg/40 transition-colors">
                  <td className="p-3 font-mono font-semibold text-zinc-200">{svc.name}</td>
                  <td className="p-3 font-mono text-[10px] text-zinc-500">{svc.ns}</td>
                  <td className="p-3">{svc.type}</td>
                  <td className="p-3 font-mono text-zinc-400">{svc.clusterIp}</td>
                  <td className="p-3 font-mono text-accent">{svc.ports}</td>
                  <td className="p-3 text-zinc-500">{svc.age}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

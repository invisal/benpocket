import React from 'react';

interface NamespaceInfoBarProps {
  lensSelectedCluster: string;
  lensSelectedNamespace: string;
  setLensNamespace: (ns: string) => void;
}

export const NamespaceInfoBar: React.FC<NamespaceInfoBarProps> = ({
  lensSelectedCluster,
  lensSelectedNamespace,
  setLensNamespace
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0 bg-sidebar-bg/60 p-3 border border-border-dark rounded-lg select-none">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white flex items-center gap-1.5">
          <span className="text-base">☸️</span> {lensSelectedCluster}
        </span>
        <span className="text-zinc-655">|</span>
        <span className="text-xs text-zinc-400">Namespace:</span>
        <select
          value={lensSelectedNamespace}
          onChange={(e) => setLensNamespace(e.target.value)}
          className="bg-editor-bg border border-border-dark text-[11px] rounded px-2 py-0.5 focus:outline-none focus:border-accent text-zinc-300 cursor-pointer"
        >
          <option value="All Namespaces">All Namespaces</option>
          <option value="default">default</option>
          <option value="kube-system">kube-system</option>
          <option value="ingress-nginx">ingress-nginx</option>
          <option value="database">database</option>
        </select>
      </div>
      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
        Kubernetes Engine (Lens Mock)
      </span>
    </div>
  );
};

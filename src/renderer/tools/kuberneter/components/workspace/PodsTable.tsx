import React, { useState } from 'react';

interface PodRow {
  name: string;
  ns: string;
  status: string;
  restarts: number;
  age: string;
}

interface PodsTableProps {
  podsData: PodRow[];
  kuberneterSelectedNamespace: string;
}

export const PodsTable: React.FC<PodsTableProps> = ({ podsData, kuberneterSelectedNamespace }) => {
  const [selectedPod, setSelectedPod] = useState<PodRow | null>(null);


  return (
    <div className="flex-1 flex gap-4 min-h-0">
      {/* Table Container */}
      <div className="flex-1 bg-sidebar-bg border border-border-dark rounded-lg overflow-hidden flex flex-col min-h-0 select-none">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-editor-bg border-b border-border-dark text-zinc-450 text-[10px] font-bold uppercase tracking-wider">
                <th className="p-3">Name</th>
                <th className="p-3">Namespace</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Restarts</th>
                <th className="p-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark/60 text-zinc-300">
              {podsData
                .filter(
                  (p) =>
                    kuberneterSelectedNamespace === 'All Namespaces' ||
                    p.ns === kuberneterSelectedNamespace
                )
                .map((pod, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedPod(pod)}
                    className={`hover:bg-editor-bg/40 cursor-pointer transition-colors ${
                      selectedPod?.name === pod.name ? 'bg-border-dark/50' : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-semibold text-zinc-200">{pod.name}</td>
                    <td className="p-3 font-mono text-[10px] text-zinc-550">{pod.ns}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-900/30">
                        {pod.status}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono text-zinc-350">{pod.restarts}</td>
                    <td className="p-3 text-zinc-500">{pod.age}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pod details sliding side drawer panel */}
      {selectedPod && (
        <div className="w-80 bg-sidebar-bg border border-border-dark rounded-lg p-4 flex flex-col gap-3.5 shrink-0 overflow-y-auto select-none animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Pod Details
            </span>
            <button
              onClick={() => setSelectedPod(null)}
              className="text-zinc-500 hover:text-white cursor-pointer text-xs border-none bg-transparent"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500 uppercase">Resource Name</span>
              <span className="font-mono text-zinc-200 break-all">{selectedPod.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500 uppercase">Namespace</span>
              <span className="font-mono text-zinc-300">{selectedPod.ns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500 uppercase">IP Status</span>
              <span className="font-mono text-zinc-300">10.244.0.12 (Node: minikube)</span>
            </div>
          </div>

          {/* Event Logs Drawer Mockup */}
          <div className="flex flex-col gap-1.5 mt-2 flex-1 border-t border-border-dark/60 pt-3">
            <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
            <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">12s ago</span>
                <span>Scheduled pod to minikube</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">10s ago</span>
                <span>Successfully pulled container image</span>
              </div>
              <div className="flex gap-1">
                <span className="text-emerald-500 font-bold">8s ago</span>
                <span>Created and started docker container</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

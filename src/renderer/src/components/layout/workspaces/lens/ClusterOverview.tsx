import React from 'react';

export const ClusterOverview: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0 select-none">
      {/* Metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            label: 'CPU Allocation',
            val: '14 / 16 Cores',
            pct: 87,
            barColor: 'bg-emerald-500'
          },
          {
            label: 'Memory Allocation',
            val: '24.2 / 32 GB',
            pct: 75,
            barColor: 'bg-accent'
          },
          {
            label: 'Pods capacity',
            val: '67 / 110 Pods',
            pct: 60,
            barColor: 'bg-amber-500'
          }
        ].map((metric, i) => (
          <div
            key={i}
            className="bg-sidebar-bg border border-border-dark p-3.5 rounded-lg flex flex-col gap-2"
          >
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-zinc-450">{metric.label}</span>
              <span className="text-zinc-300 font-bold">{metric.val}</span>
            </div>
            <div className="h-1.5 bg-editor-bg rounded-full overflow-hidden border border-border-dark/60">
              <div className={`h-full ${metric.barColor}`} style={{ width: `${metric.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick cluster highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        <div className="bg-sidebar-bg border border-border-dark p-4 rounded-lg flex flex-col gap-2.5">
          <span className="text-xs font-bold text-zinc-400">CLUSTER COMPLIANCE ALERTS</span>
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 p-2.5 bg-red-950/20 border border-red-950/30 rounded text-xs text-red-400">
              <span className="font-bold">❌</span>
              <span>
                Pod `payment-processor-78d46dbb4d-f9s22` restarted 2 times in the last 15m.
              </span>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-amber-950/20 border border-amber-950/30 rounded text-xs text-amber-400">
              <span className="font-bold">⚠️</span>
              <span>
                CPU throttling warning on namespace `ingress-nginx` (ingress controller limits).
              </span>
            </div>
          </div>
        </div>

        <div className="bg-sidebar-bg border border-border-dark p-4 rounded-lg flex flex-col gap-3">
          <span className="text-xs font-bold text-zinc-400">WORKLOAD CONTROLLER STATUS</span>
          <div className="flex flex-col gap-1.5 text-xs text-zinc-300">
            <div className="flex justify-between p-1.5 border-b border-border-dark/60">
              <span>Deployments</span>
              <span className="text-emerald-500 font-bold">3 Active</span>
            </div>
            <div className="flex justify-between p-1.5 border-b border-border-dark/60">
              <span>ReplicaSets</span>
              <span className="text-emerald-500 font-bold">3 Synced</span>
            </div>
            <div className="flex justify-between p-1.5">
              <span>DaemonSets</span>
              <span className="text-zinc-500">0 Running</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

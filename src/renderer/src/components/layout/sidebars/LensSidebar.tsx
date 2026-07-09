import React from 'react';
import { useLayoutStore } from '../../../store/layout.store';

type LensResource = 'overview' | 'pods' | 'deployments' | 'services' | 'configmaps';

export const LensSidebar: React.FC = () => {
  const {
    openTab,
    activeInstanceId,
    lensInstanceCluster,
    setLensInstanceCluster,
    lensInstanceResource,
    setLensInstanceResource
  } = useLayoutStore();

  const cluster = lensInstanceCluster[activeInstanceId] || 'minikube';
  const resource = lensInstanceResource[activeInstanceId] || 'overview';

  return (
    <div className="flex flex-col gap-4">
      {/* Cluster Selector */}
      <div className="flex flex-col gap-1 shrink-0">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
          Kubernetes Cluster
        </span>
        <select
          value={cluster}
          onChange={(e) => setLensInstanceCluster(activeInstanceId, e.target.value)}
          className="w-full bg-editor-bg border border-border-dark text-xs rounded px-2 py-1.5 focus:outline-none focus:border-accent text-zinc-300 cursor-pointer"
        >
          <option value="minikube">☸️ minikube</option>
          <option value="prod-cluster-us">☸️ prod-cluster-us</option>
          <option value="staging-cluster-eu">☸️ staging-cluster-eu</option>
        </select>
      </div>

      {/* K8s Navigation Resources */}
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
          Navigation
        </span>
        <div className="flex flex-col gap-0.5 mt-1">
          {/* 1. Cluster Overview */}
          <button
            onClick={() => {
              setLensInstanceResource(activeInstanceId, 'overview');
              openTab({
                id: `lens-k8s-dashboard-${activeInstanceId}`,
                title: 'K8s Overview',
                type: 'lens',
                instanceId: activeInstanceId
              });
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left cursor-pointer transition-all ${
              resource === 'overview'
                ? 'bg-border-dark text-white font-semibold'
                : 'text-zinc-400 hover:bg-border-dark/30 hover:text-zinc-200'
            }`}
          >
            <span>☸️</span>
            <span>Cluster Overview</span>
          </button>

          {/* 2. Workloads Category Header */}
          <div className="mt-2 px-1 text-[9px] font-bold text-zinc-550 uppercase tracking-wider">
            Workloads
          </div>
          {(
            [
              { id: 'pods', label: 'Pods', icon: '📦' },
              { id: 'deployments', label: 'Deployments', icon: '🚀' }
            ] satisfies { id: LensResource; label: string; icon: string }[]
          ).map((res) => (
            <button
              key={res.id}
              onClick={() => {
                setLensInstanceResource(activeInstanceId, res.id);
                openTab({
                  id: `lens-k8s-${res.id}-${activeInstanceId}`,
                  title: `K8s ${res.label}`,
                  type: 'lens',
                  instanceId: activeInstanceId
                });
              }}
              className={`w-full flex items-center gap-2 px-4 py-1.5 rounded text-xs text-left cursor-pointer transition-all ${
                resource === res.id
                  ? 'bg-border-dark text-white font-semibold'
                  : 'text-zinc-400 hover:bg-border-dark/30 hover:text-zinc-200'
              }`}
            >
              <span>{res.icon}</span>
              <span>{res.label}</span>
            </button>
          ))}

          {/* 3. Network Category Header */}
          <div className="mt-2 px-1 text-[9px] font-bold text-zinc-550 uppercase tracking-wider">
            Network
          </div>
          {(
            [{ id: 'services', label: 'Services', icon: '🔌' }] satisfies {
              id: LensResource;
              label: string;
              icon: string;
            }[]
          ).map((res) => (
            <button
              key={res.id}
              onClick={() => {
                setLensInstanceResource(activeInstanceId, res.id);
                openTab({
                  id: `lens-k8s-${res.id}-${activeInstanceId}`,
                  title: `K8s ${res.label}`,
                  type: 'lens',
                  instanceId: activeInstanceId
                });
              }}
              className={`w-full flex items-center gap-2 px-4 py-1.5 rounded text-xs text-left cursor-pointer transition-all ${
                resource === res.id
                  ? 'bg-border-dark text-white font-semibold'
                  : 'text-zinc-400 hover:bg-border-dark/30 hover:text-zinc-200'
              }`}
            >
              <span>{res.icon}</span>
              <span>{res.label}</span>
            </button>
          ))}

          {/* 4. Configuration Category Header */}
          <div className="mt-2 px-1 text-[9px] font-bold text-zinc-550 uppercase tracking-wider">
            Configuration
          </div>
          {(
            [{ id: 'configmaps', label: 'ConfigMaps', icon: '⚙️' }] satisfies {
              id: LensResource;
              label: string;
              icon: string;
            }[]
          ).map((res) => (
            <button
              key={res.id}
              onClick={() => {
                setLensInstanceResource(activeInstanceId, res.id);
                openTab({
                  id: `lens-k8s-${res.id}-${activeInstanceId}`,
                  title: `K8s ${res.label}`,
                  type: 'lens',
                  instanceId: activeInstanceId
                });
              }}
              className={`w-full flex items-center gap-2 px-4 py-1.5 rounded text-xs text-left cursor-pointer transition-all ${
                resource === res.id
                  ? 'bg-border-dark text-white font-semibold'
                  : 'text-zinc-400 hover:bg-border-dark/30 hover:text-zinc-200'
              }`}
            >
              <span>{res.icon}</span>
              <span>{res.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

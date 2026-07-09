import React, { useState } from 'react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { Input } from '../../../../src/components/ui/Input';
import {
  ChevronDown,
  ChevronRight,
  Monitor,
  Cpu,
  Layers,
  Settings,
  Globe,
  Database,
  Tag,
  Clock,
  ShieldCheck,
  Package,
  Boxes,
  Search
} from 'lucide-react';

interface SidebarCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: Array<{ id: string; label: string }>;
}

function highlightText(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-accent/20 text-accent font-semibold px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export const KuberneterSidebar: React.FC = () => {
  const {
    openTab,
    activeInstanceId,
    kuberneterInstanceCluster,
    kuberneterInstanceResource,
    setKuberneterInstanceResource
  } = useLayoutStore();

  const cluster = kuberneterInstanceCluster[activeInstanceId] || '';
  const activeResource = kuberneterInstanceResource[activeInstanceId] || 'overview';

  const [searchTerm, setSearchTerm] = useState('');

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    workloads: true,
    config: false,
    network: false,
    storage: false,
    accessControl: false,
    crds: false
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleSelectResource = (resourceId: string, label: string) => {
    setKuberneterInstanceResource(activeInstanceId, resourceId);
    openTab({
      id: `kuberneter-k8s-${resourceId}-${activeInstanceId}`,
      title: `K8s ${label}`,
      type: 'kuberneter',
      instanceId: activeInstanceId,
      meta: { resource: resourceId }
    });
  };

  const categories: SidebarCategory[] = [
    { id: 'overview', label: 'Overview', icon: Monitor },
    { id: 'apps', label: 'Applications', icon: Layers },
    { id: 'nodes', label: 'Nodes', icon: Cpu },
    {
      id: 'workloads',
      label: 'Workloads',
      icon: Boxes,
      subItems: [
        { id: 'workloads-overview', label: 'Overview' },
        { id: 'pods', label: 'Pods' },
        { id: 'deployments', label: 'Deployments' },
        { id: 'daemonsets', label: 'Daemon Sets' },
        { id: 'statefulsets', label: 'Stateful Sets' },
        { id: 'replicasets', label: 'Replica Sets' },
        { id: 'jobs', label: 'Jobs' },
        { id: 'cronjobs', label: 'Cron Jobs' }
      ]
    },
    {
      id: 'config',
      label: 'Config',
      icon: Settings,
      subItems: [
        { id: 'configmaps', label: 'Config Maps' },
        { id: 'secrets', label: 'Secrets' },
        { id: 'resourcequotas', label: 'Resource Quotas' },
        { id: 'limitranges', label: 'Limit Ranges' },
        { id: 'hpas', label: 'HPAs' },
        { id: 'pdbs', label: 'PDBs' }
      ]
    },
    {
      id: 'network',
      label: 'Network',
      icon: Globe,
      subItems: [
        { id: 'services', label: 'Services' },
        { id: 'endpoints', label: 'Endpoints' },
        { id: 'ingresses', label: 'Ingresses' },
        { id: 'networkpolicies', label: 'Network Policies' },
        { id: 'portforwarding', label: 'Port Forwarding' }
      ]
    },
    {
      id: 'storage',
      label: 'Storage',
      icon: Database,
      subItems: [
        { id: 'pvcs', label: 'PVCs' },
        { id: 'pvs', label: 'PVs' },
        { id: 'storageclasses', label: 'Storage Classes' }
      ]
    },
    { id: 'namespaces', label: 'Namespaces', icon: Tag },
    { id: 'events', label: 'Events', icon: Clock },
    {
      id: 'helm',
      label: 'Helm',
      icon: Package,
      subItems: [
        { id: 'helm-charts', label: 'Charts' },
        { id: 'helm-releases', label: 'Releases' }
      ]
    },
    {
      id: 'accessControl',
      label: 'Access Control',
      icon: ShieldCheck,
      subItems: [
        { id: 'serviceaccounts', label: 'Service Accounts' },
        { id: 'clusterroles', label: 'Cluster Roles' },
        { id: 'roles', label: 'Roles' },
        { id: 'bindings', label: 'Role Bindings' }
      ]
    }
  ];

  if (!cluster) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-550 gap-2.5 p-4 text-center select-none h-full animate-in fade-in duration-300">
        <Monitor className="size-8 text-zinc-700 animate-pulse" />
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Disconnected
        </span>
        <p className="text-[10px] text-zinc-600 leading-relaxed max-w-[180px]">
          Please open the Kuberneter Home tab and connect to a cluster context to enable sidebar
          navigation.
        </p>
      </div>
    );
  }

  const isMatch = (text: string) => {
    if (!searchTerm) return false;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  };

  return (
    <div className="flex flex-col gap-4 h-full text-zinc-300 select-none animate-in fade-in duration-300">
      {/* Search Navigation Bar */}
      <div className="relative shrink-0 px-1 mb-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-550 z-10" />
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search navigation..."
          size="sm"
          className="pl-8 bg-surface border border-border-dark text-[11px] outline-none text-zinc-300 focus:border-accent transition-colors"
        />
      </div>

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-1">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-1 mb-1.5 font-sans">
          Navigation
        </span>

        {categories
          .map((cat) => {
            const Icon = cat.icon;
            const hasSubs = !!cat.subItems;

            // Filter subItems if search is active
            const matchingSubs = cat.subItems
              ? cat.subItems.filter(
                  (sub) => !searchTerm || isMatch(sub.label) || isMatch(cat.label)
                )
              : [];

            // Skip rendering if search is active and neither parent nor subItems match
            if (searchTerm && !isMatch(cat.label) && matchingSubs.length === 0) {
              return null;
            }

            const isExpanded = searchTerm
              ? matchingSubs.length > 0 || isMatch(cat.label)
              : expandedGroups[cat.id];

            if (!hasSubs) {
              const isActive = activeResource === cat.id;
              const isHighlighted = isMatch(cat.label);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectResource(cat.id, cat.label)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-left cursor-pointer transition-all ${
                    isActive
                      ? 'bg-border-dark text-white font-semibold'
                      : isHighlighted
                        ? 'text-accent font-semibold bg-accent/5'
                        : 'text-zinc-400 hover:bg-border-dark/30 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{highlightText(cat.label, searchTerm)}</span>
                </button>
              );
            }

            // Category with Sub-items (collapsible)
            const isSubActive = cat.subItems?.some((sub) => activeResource === sub.id);
            const isParentHighlighted = isMatch(cat.label);

            return (
              <div key={cat.id} className="flex flex-col">
                <button
                  onClick={() => toggleGroup(cat.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left cursor-pointer transition-all ${
                    isSubActive
                      ? 'text-white font-medium'
                      : isParentHighlighted
                        ? 'text-accent font-semibold bg-accent/5'
                        : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0" />
                    <span>{highlightText(cat.label, searchTerm)}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="size-3 text-zinc-500" />
                  ) : (
                    <ChevronRight className="size-3 text-zinc-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="flex flex-col pl-6 border-l border-border-dark/40 ml-4.5 mt-0.5 gap-0.5">
                    {matchingSubs.map((sub) => {
                      const isActive = activeResource === sub.id;
                      const isSubHighlighted = isMatch(sub.label);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleSelectResource(sub.id, sub.label)}
                          className={`w-full py-1 px-2.5 rounded text-[11px] text-left cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-border-dark/60 text-accent font-semibold'
                              : isSubHighlighted
                                ? 'text-accent font-semibold bg-accent/5'
                                : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {highlightText(sub.label, searchTerm)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
          .filter(Boolean)}
      </div>
    </div>
  );
};

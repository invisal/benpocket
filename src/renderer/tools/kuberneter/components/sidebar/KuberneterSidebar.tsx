import type React from 'react';
import { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { KubeSearchbox } from '../KubeSearchbox';
import { Select } from '@renderer/components/ui/Select';
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
  Server
} from 'lucide-react';

interface SidebarCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: Array<{ id: string; label: string }>;
}

function highlightText(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const regex = new RegExp(`(${search.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
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
  const { openTab, openTabs, activeTabId, activeInstanceId } = useLayoutStore();
  const {
    kuberneterInstanceCluster,
    kuberneterInstanceResource,
    setKuberneterInstanceResource,
    kuberneterInstanceNamespace,
    setKuberneterInstanceNamespace,
    kuberneterInstanceConfigPath
  } = useKuberneterStore();

  const cluster = kuberneterInstanceCluster[activeInstanceId] || '';
  const namespace = kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces';
  const configPath = kuberneterInstanceConfigPath[activeInstanceId] || 'default';
  const activeResource = kuberneterInstanceResource[activeInstanceId] || 'overview';

  const [namespaces, setNamespaces] = useState<string[]>([
    'All Namespaces',
    'default',
    'kube-system',
    'ingress-nginx',
    'database'
  ]);

  useEffect(() => {
    if (!cluster || !activeInstanceId) return;

    const fetchNamespaces = async () => {
      try {
        const configPathArg = configPath === 'default' ? undefined : configPath;
        const res = await window.kuberneter.getResources(configPathArg, cluster, 'namespaces');
        if (res && Array.isArray(res.items)) {
          const names = (res.items as { metadata?: { name?: string } }[])
            .map((item) => item.metadata?.name)
            .filter(Boolean) as string[];
          setNamespaces(['All Namespaces', ...names]);
        }
      } catch (err) {
        console.error('Failed to load namespaces in sidebar:', err);
      }
    };

    fetchNamespaces();
  }, [cluster, configPath, activeInstanceId]);

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

  // Sync sidebar selection when active tab changes
  useEffect(() => {
    const activeTab = openTabs.find((t) => t.id === activeTabId);
    if (!activeTab || activeTab.instanceId !== activeInstanceId) return;
    const tabResource = (activeTab.meta as { resource?: string })?.resource;
    if (!tabResource || tabResource === activeResource) return;
    setKuberneterInstanceResource(activeInstanceId, tabResource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Static map: which group owns each sub-resource
  const resourceGroupMap: Record<string, string> = {
    'workloads-overview': 'workloads',
    pods: 'workloads',
    deployments: 'workloads',
    daemonsets: 'workloads',
    statefulsets: 'workloads',
    replicasets: 'workloads',
    jobs: 'workloads',
    cronjobs: 'workloads',
    configmaps: 'config',
    secrets: 'config',
    resourcequotas: 'config',
    limitranges: 'config',
    hpas: 'config',
    pdbs: 'config',
    priorityclasses: 'config',
    runtimeclasses: 'config',
    leases: 'config',
    mutatingwebhooks: 'config',
    validatingwebhooks: 'config',
    services: 'network',
    endpoints: 'network',
    ingresses: 'network',
    networkpolicies: 'network',
    portforwarding: 'network',
    pvcs: 'storage',
    pvs: 'storage',
    storageclasses: 'storage',
    serviceaccounts: 'accessControl',
    clusterroles: 'accessControl',
    roles: 'accessControl',
    bindings: 'accessControl',
    'helm-charts': 'helm',
    'helm-releases': 'helm'
  };

  // Derive expanded groups: merge user-toggled state with the group that contains the active resource
  const activeGroupId = resourceGroupMap[activeResource];
  const effectiveExpandedGroups = activeGroupId
    ? { ...expandedGroups, [activeGroupId]: true }
    : expandedGroups;

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
        { id: 'hpas', label: 'Horizontal Pod Autoscalers' },
        { id: 'pdbs', label: 'Pod Disruption Budgets' },
        { id: 'priorityclasses', label: 'Priority Classes' },
        { id: 'runtimeclasses', label: 'Runtime Classes' },
        { id: 'leases', label: 'Leases' },
        { id: 'mutatingwebhooks', label: 'Mutating Webhook Configurations' },
        { id: 'validatingwebhooks', label: 'Validating Webhook Configurations' }
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
    <div className="flex flex-col h-full text-zinc-300 select-none animate-in fade-in duration-300 kuberneter-sidebar">
      {/* 1. Namespace header — same height as tab bar (h-9) */}
      <div className="h-9 shrink-0 flex items-center mx-[-12px] mt-[-12px] px-3 border-b border-border-dark">
        <Select.Root
          value={namespace}
          onValueChange={(val) => val && setKuberneterInstanceNamespace(activeInstanceId, val)}
        >
          <Select.Trigger
            variant="ghost"
            size="sm"
            icon={<Tag className="size-3.5 text-zinc-500" />}
            className="w-full flex items-center justify-between text-xs font-sans h-7 px-1.5 hover:bg-border-dark/30"
          >
            <Select.Value />
          </Select.Trigger>
          <Select.Content side="bottom" align="start">
            {namespaces.map((ns) => (
              <Select.Item key={ns} value={ns}>
                <Select.ItemText>{ns}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>

      {/* 2. Search section — same height as workspace header (h-11) */}
      <div className="h-11 shrink-0 flex items-center border-b border-border-dark mx-[-12px] px-3">
        <KubeSearchbox
          value={searchTerm}
          placeholder="Search navigation..."
          onChange={setSearchTerm}
          className="flex-1 [&_input]:bg-surface-1"
        />
      </div>

      {/* 3. Navigation section — remaining height */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 mr-[-12px] pr-[12px] pt-2 kuberneter-sidebar-scroll">
        <span
          className="text-xs font-bold text-zinc-200 uppercase tracking-wider px-1 mb-1.5 font-sans flex items-center gap-2 truncate"
          title={cluster}
        >
          <Server className="size-4 shrink-0 text-zinc-400" />
          <span>{cluster}</span>
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
              : effectiveExpandedGroups[cat.id];

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

import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type NetworkPolicyData } from '../../../types/NetworkPolicyData';
import { NetworkPoliciesToolbar } from './NetworkPoliciesToolbar';
import { NetworkPoliciesTable } from './NetworkPoliciesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { ResourceView } from '../ResourceView';
import { useNetworkPolicies } from '../../../hooks/useNetworkPolicies';

interface NetworkPoliciesProps {
  kuberneterSelectedNamespace: string;
}

export const NetworkPolicies: React.FC<NetworkPoliciesProps> = ({
  kuberneterSelectedNamespace
}) => {
  const { data: networkPoliciesData, isLoading, errorMsg } = useNetworkPolicies(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedPolicyId =
    drawerState?.isOpen && drawerState?.contentType === 'networkpolicies'
      ? (drawerState?.payload as NetworkPolicyData)?.id
      : undefined;

  const handleSelectPolicy = useCallback(
    (policy: NetworkPolicyData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'networkpolicies',
          payload: policy
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  const handleNamespaceClick = useCallback(
    (ns: string) => {
      if (activeInstanceId) {
        useKuberneterStore.getState().setKuberneterInstanceNamespace(activeInstanceId, ns);
      }
    },
    [activeInstanceId]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return networkPoliciesData.filter((policy) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        policy.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [policy.name, policy.ns, policy.policyTypesStr, policy.age];

      if (useRegex) {
        try {
          const flags = caseSensitive ? '' : 'i';
          const regex = new RegExp(searchQuery, flags);
          return fields.some((f) => regex.test(f));
        } catch {
          return false;
        }
      } else {
        const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
        return fields.some((f) => {
          const val = caseSensitive ? f : f.toLowerCase();
          return val.includes(query);
        });
      }
    });
  }, [networkPoliciesData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(filteredData.map((d) => d.id)) : new Set());
    },
    [filteredData]
  );

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleDownloadCsv = () => {
    const dataToExport =
      selectedIds.size > 0 ? filteredData.filter((d) => selectedIds.has(d.id)) : filteredData;

    if (dataToExport.length === 0) return;

    const headers = ['Name', 'Namespace', 'Policy Types', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((policy) => {
      const row = [
        `"${policy.name}"`,
        `"${policy.ns}"`,
        `"${policy.policyTypesStr}"`,
        `"${policy.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `networkpolicies-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResourceView isLoading={isLoading} errorMsg={errorMsg}>
      <KubeWorkspaceLayout
        header={
          <NetworkPoliciesToolbar
            searchQuery={searchQuery}
            caseSensitive={caseSensitive}
            useRegex={useRegex}
            totalCount={filteredData.length}
            selectedCount={selectedIds.size}
            onSearchChange={setSearchQuery}
            onCaseSensitiveToggle={() => setCaseSensitive((v) => !v)}
            onRegexToggle={() => setUseRegex((v) => !v)}
            onDownload={handleDownloadCsv}
          />
        }
      >
        <NetworkPoliciesTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectPolicy={handleSelectPolicy}
          onNamespaceClick={handleNamespaceClick}
          selectedPolicyId={selectedPolicyId}
        />
      </KubeWorkspaceLayout>
    </ResourceView>
  );
};

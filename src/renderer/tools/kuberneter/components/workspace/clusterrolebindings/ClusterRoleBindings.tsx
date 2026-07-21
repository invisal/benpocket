import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type ClusterRoleBindingData } from '../../../types/ClusterRoleBindingData';
import { ClusterRoleBindingsToolbar } from './ClusterRoleBindingsToolbar';
import { ClusterRoleBindingsTable } from './ClusterRoleBindingsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface ClusterRoleBindingsProps {
  clusterRoleBindingsData: ClusterRoleBindingData[];
}

export const ClusterRoleBindings: React.FC<ClusterRoleBindingsProps> = ({
  clusterRoleBindingsData
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedBindingId =
    drawerState?.isOpen && drawerState?.contentType === 'clusterrolebinding'
      ? (drawerState?.payload as ClusterRoleBindingData)?.id
      : undefined;

  const handleSelectBinding = useCallback(
    (binding: ClusterRoleBindingData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'clusterrolebinding',
          payload: binding
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return clusterRoleBindingsData.filter((binding) => {
      if (!searchQuery) return true;

      const labelsStr = binding.labels
        ? Object.entries(binding.labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
        : '';

      const roleRefStr = binding.roleRef
        ? `${binding.roleRef.kind} ${binding.roleRef.name} ${binding.roleRef.apiGroup}`
        : '';

      const subjectsStr = binding.subjects
        ? binding.subjects.map((s) => `${s.kind} ${s.name} ${s.namespace || ''}`).join(' ')
        : '';

      const fields = [binding.name, binding.age, labelsStr, roleRefStr, subjectsStr];

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
  }, [clusterRoleBindingsData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Role Reference', 'Bindings', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((binding) => {
      const roleRefStr = binding.roleRef ? `${binding.roleRef.kind}/${binding.roleRef.name}` : '';
      const subjectsStr = binding.subjects ? binding.subjects.map((s) => s.name).join(';') : '';
      const row = [`"${binding.name}"`, `"${roleRefStr}"`, `"${subjectsStr}"`, `"${binding.age}"`];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clusterrolebinding-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <ClusterRoleBindingsToolbar
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
      <ClusterRoleBindingsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectBinding={handleSelectBinding}
        selectedBindingId={selectedBindingId}
      />
    </KubeWorkspaceLayout>
  );
};

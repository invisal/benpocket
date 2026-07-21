import type React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { type RoleBindingData } from '../../../types/RoleBindingData';
import { RoleBindingsToolbar } from './RoleBindingsToolbar';
import { RoleBindingsTable } from './RoleBindingsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface RoleBindingsProps {
  roleBindingsData: RoleBindingData[];
}

export const RoleBindings: React.FC<RoleBindingsProps> = ({ roleBindingsData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);

  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const configPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const namespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  const [namespaces, setNamespaces] = useState<string[]>(['All Namespaces']);

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
        console.error('Failed to load namespaces in RoleBindings:', err);
      }
    };

    fetchNamespaces();
  }, [cluster, configPath, activeInstanceId]);

  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedBindingId =
    drawerState?.isOpen && drawerState?.contentType === 'rolebinding'
      ? (drawerState?.payload as RoleBindingData)?.id
      : undefined;

  const handleSelectBinding = useCallback(
    (binding: RoleBindingData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'rolebinding',
          payload: binding
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return roleBindingsData.filter((binding) => {
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

      const fields = [binding.name, binding.ns, binding.age, labelsStr, roleRefStr, subjectsStr];

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
  }, [roleBindingsData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Role Reference', 'Bindings', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((binding) => {
      const roleRefStr = binding.roleRef ? `${binding.roleRef.kind}/${binding.roleRef.name}` : '';
      const subjectsStr = binding.subjects ? binding.subjects.map((s) => s.name).join(';') : '';
      const row = [
        `"${binding.name}"`,
        `"${binding.ns}"`,
        `"${roleRefStr}"`,
        `"${subjectsStr}"`,
        `"${binding.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rolebinding-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleNamespaceChange = useCallback(
    (val: string | null) => {
      if (activeInstanceId && val) {
        setNamespace(activeInstanceId, val);
      }
    },
    [activeInstanceId, setNamespace]
  );

  return (
    <KubeWorkspaceLayout
      header={
        <RoleBindingsToolbar
          searchQuery={searchQuery}
          caseSensitive={caseSensitive}
          useRegex={useRegex}
          totalCount={filteredData.length}
          selectedCount={selectedIds.size}
          namespaces={namespaces}
          namespace={namespace}
          onNamespaceChange={handleNamespaceChange}
          onSearchChange={setSearchQuery}
          onCaseSensitiveToggle={() => setCaseSensitive((v) => !v)}
          onRegexToggle={() => setUseRegex((v) => !v)}
          onDownload={handleDownloadCsv}
        />
      }
    >
      <RoleBindingsTable
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

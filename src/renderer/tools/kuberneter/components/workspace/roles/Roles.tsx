import type React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { type RoleData } from '../../../types/RoleData';
import { RolesToolbar } from './RolesToolbar';
import { RolesTable } from './RolesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface RolesProps {
  rolesData: RoleData[];
}

export const Roles: React.FC<RolesProps> = ({ rolesData }) => {
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
        console.error('Failed to load namespaces in Roles:', err);
      }
    };

    fetchNamespaces();
  }, [cluster, configPath, activeInstanceId]);

  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedRoleId =
    drawerState?.isOpen && drawerState?.contentType === 'role'
      ? (drawerState?.payload as RoleData)?.id
      : undefined;

  const handleSelectRole = useCallback(
    (role: RoleData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'role',
          payload: role
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return rolesData.filter((role) => {
      if (!searchQuery) return true;

      const labelsStr = role.labels
        ? Object.entries(role.labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
        : '';

      const rulesStr = role.rules
        ? role.rules
            .map((r) => {
              const resources = r.resources?.join(',') || '';
              const verbs = r.verbs?.join(',') || '';
              const groups = r.apiGroups?.join(',') || '';
              const resourceNames = r.resourceNames?.join(',') || '';
              return `${resources} ${verbs} ${groups} ${resourceNames}`;
            })
            .join(' ')
        : '';

      const fields = [role.name, role.ns, role.age, labelsStr, rulesStr];

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
  }, [rolesData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Labels', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((role) => {
      const labelsStr = role.labels
        ? Object.entries(role.labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(';')
        : '';
      const row = [`"${role.name}"`, `"${role.ns}"`, `"${labelsStr}"`, `"${role.age}"`];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `role-export-${Date.now()}.csv`;
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
        <RolesToolbar
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
      <RolesTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectRole={handleSelectRole}
        selectedRoleId={selectedRoleId}
      />
    </KubeWorkspaceLayout>
  );
};

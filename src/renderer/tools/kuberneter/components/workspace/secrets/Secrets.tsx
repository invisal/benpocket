import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type SecretData } from '../../../types/SecretData';
import { SecretsToolbar } from './SecretsToolbar';
import { SecretsTable } from './SecretsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface SecretsProps {
  secretsData: SecretData[];
  kuberneterSelectedNamespace: string;
}

export const Secrets: React.FC<SecretsProps> = ({ secretsData, kuberneterSelectedNamespace }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const selectedSecretId =
    drawerState?.isOpen && drawerState?.contentType === 'secret'
      ? (drawerState?.payload as SecretData)?.id
      : undefined;

  const handleSelectSecret = useCallback(
    (secret: SecretData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'secret',
          payload: secret
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return secretsData.filter((secret) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        secret.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const labelsArr = secret.labels ? Object.entries(secret.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const keysStr = secret.keysList ? secret.keysList.join(', ') : '';
      const fields = [secret.name, secret.ns, labelsStr, keysStr, secret.type, secret.age];

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
  }, [secretsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Labels', 'Keys Count', 'Keys', 'Type', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((secret) => {
      const labelsArr = secret.labels ? Object.entries(secret.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join('; ');
      const keysStr = secret.keysList ? secret.keysList.join('; ') : '';
      const row = [
        `"${secret.name}"`,
        `"${secret.ns}"`,
        `"${labelsStr}"`,
        secret.keysCount,
        `"${keysStr}"`,
        `"${secret.type}"`,
        `"${secret.age}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `secrets-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <SecretsToolbar
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
      <SecretsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectSecret={handleSelectSecret}
        selectedSecretId={selectedSecretId}
      />
    </KubeWorkspaceLayout>
  );
};

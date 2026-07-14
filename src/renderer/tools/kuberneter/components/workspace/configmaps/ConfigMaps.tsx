import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type ConfigMapData } from '../../../types/ConfigMapData';
import { ConfigMapsToolbar } from './ConfigMapsToolbar';
import { ConfigMapsTable } from './ConfigMapsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface ConfigMapsProps {
  configMapsData: ConfigMapData[];
  kuberneterSelectedNamespace: string;
}

export const ConfigMaps: React.FC<ConfigMapsProps> = ({
  configMapsData,
  kuberneterSelectedNamespace
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

  const selectedConfigMapId =
    drawerState?.isOpen && drawerState?.contentType === 'configmap'
      ? (drawerState?.payload as ConfigMapData)?.id
      : undefined;

  const handleSelectConfigMap = useCallback(
    (cm: ConfigMapData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'configmap',
          payload: cm
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return configMapsData.filter((cm) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        cm.ns !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const keysStr = cm.keysList ? cm.keysList.join(', ') : '';
      const fields = [cm.name, cm.ns, keysStr, cm.age];

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
  }, [configMapsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Namespace', 'Keys Count', 'Keys', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((cm) => {
      const keysStr = cm.keysList ? cm.keysList.join('; ') : '';
      const row = [`"${cm.name}"`, `"${cm.ns}"`, cm.keysCount, `"${keysStr}"`, `"${cm.age}"`];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `configmaps-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <ConfigMapsToolbar
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
      <ConfigMapsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectConfigMap={handleSelectConfigMap}
        selectedConfigMapId={selectedConfigMapId}
      />
    </KubeWorkspaceLayout>
  );
};

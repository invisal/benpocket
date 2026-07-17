import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type ValidatingWebhookConfigurationData } from '../../../types/ValidatingWebhookConfigurationData';
import { ValidatingWebhooksToolbar } from './ValidatingWebhooksToolbar';
import { ValidatingWebhooksTable } from './ValidatingWebhooksTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface ValidatingWebhooksProps {
  validatingWebhooksData: ValidatingWebhookConfigurationData[];
}

export const ValidatingWebhooks: React.FC<ValidatingWebhooksProps> = ({
  validatingWebhooksData
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

  const selectedWebhookId =
    drawerState?.isOpen && drawerState?.contentType === 'validatingwebhook'
      ? (drawerState?.payload as ValidatingWebhookConfigurationData)?.id
      : undefined;

  const handleSelectWebhook = useCallback(
    (webhook: ValidatingWebhookConfigurationData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'validatingwebhook',
          payload: webhook
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return validatingWebhooksData.filter((webhook) => {
      if (!searchQuery) return true;

      const labelsArr = webhook.labels ? Object.entries(webhook.labels) : [];
      const labelsStr = labelsArr.map(([k, v]) => `${k}=${v}`).join(', ');
      const fields = [webhook.name, labelsStr, String(webhook.webhooksCount), webhook.age];

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
  }, [validatingWebhooksData, searchQuery, caseSensitive, useRegex]);

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

    const headers = ['Name', 'Webhooks Count', 'API Version', 'Age'];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((w) => {
      const row = [`"${w.name}"`, w.webhooksCount, `"${w.apiVersion}"`, `"${w.age}"`];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `validatingwebhooks-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <ValidatingWebhooksToolbar
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
      <ValidatingWebhooksTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        onSelectWebhook={handleSelectWebhook}
        selectedWebhookId={selectedWebhookId}
      />
    </KubeWorkspaceLayout>
  );
};

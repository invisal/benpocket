import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type MutatingWebhookConfigurationData } from '../../../types/MutatingWebhookConfigurationData';
import { MutatingWebhooksToolbar } from './MutatingWebhooksToolbar';
import { MutatingWebhooksTable } from './MutatingWebhooksTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface MutatingWebhooksProps {
  mutatingWebhooksData: MutatingWebhookConfigurationData[];
}

export const MutatingWebhooks: React.FC<MutatingWebhooksProps> = ({ mutatingWebhooksData }) => {
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
    drawerState?.isOpen && drawerState?.contentType === 'mutatingwebhook'
      ? (drawerState?.payload as MutatingWebhookConfigurationData)?.id
      : undefined;

  const handleSelectWebhook = useCallback(
    (webhook: MutatingWebhookConfigurationData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'mutatingwebhook',
          payload: webhook
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query
  const filteredData = useMemo(() => {
    return mutatingWebhooksData.filter((webhook) => {
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
  }, [mutatingWebhooksData, searchQuery, caseSensitive, useRegex]);

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
    link.download = `mutatingwebhooks-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <KubeWorkspaceLayout
      header={
        <MutatingWebhooksToolbar
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
      <MutatingWebhooksTable
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

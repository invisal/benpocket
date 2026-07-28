import type React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { type EventData } from '../../../types/EventData';
import { EventsToolbar } from './EventsToolbar';
import { EventsTable } from './EventsTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { ResourceView } from '../ResourceView';
import { useEvents } from '../../../hooks/useEvents';

export const Events: React.FC = () => {
  const { data: eventsData, isLoading, errorMsg } = useEvents(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);
  const drawerState = useKuberneterStore((s) =>
    activeTabId ? s.kuberneterTabDrawers[activeTabId] : null
  );

  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const configPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || ''
  );
  const selectedNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  const [namespaces, setNamespaces] = useState<string[]>(['All Namespaces']);

  useEffect(() => {
    if (activeInstanceId && cluster) {
      window.kuberneter
        .getResources(configPath, cluster, 'namespaces')
        .then((res) => {
          const names =
            (res.items as Array<{ metadata?: { name?: string } }>)?.map(
              (item) => item.metadata?.name || ''
            ) || [];
          setNamespaces(['All Namespaces', ...names.filter(Boolean)]);
        })
        .catch((err) => console.error('Failed to load namespaces for Events:', err));
    }
  }, [activeInstanceId, cluster, configPath]);

  const selectedEventId =
    drawerState?.isOpen && drawerState?.contentType === 'event'
      ? (drawerState?.payload as EventData)?.id
      : undefined;

  const handleSelectEvent = useCallback(
    (event: EventData) => {
      if (activeTabId) {
        setDrawerState(activeTabId, {
          isOpen: true,
          contentType: 'event',
          payload: event
        });
      }
    },
    [activeTabId, setDrawerState]
  );

  // Filter rows by search query (namespace filter is handled by the hook/backend,
  // but if All Namespaces is selected we might want to filter locally or let backend do it)
  const filteredData = useMemo(() => {
    return eventsData.filter((ev) => {
      if (!searchQuery) return true;

      const fields = [
        ev.type,
        ev.message,
        ev.ns,
        ev.involvedObject,
        ev.involvedKind,
        ev.source,
        String(ev.count),
        ev.age,
        ev.lastSeen
      ];

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
  }, [eventsData, searchQuery, caseSensitive, useRegex]);

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

    const headers = [
      'Type',
      'Message',
      'Namespace',
      'Involved Object',
      'Source',
      'Count',
      'Age',
      'Last Seen'
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach((ev) => {
      const row = [
        `"${ev.type}"`,
        `"${ev.message.replace(/"/g, '""')}"`,
        `"${ev.ns}"`,
        `"${ev.involvedKind}: ${ev.involvedObject}"`,
        `"${ev.source}"`,
        `"${ev.count}"`,
        `"${ev.age}"`,
        `"${ev.lastSeen}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-export-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleNamespaceChange = (ns: string) => {
    if (activeInstanceId) {
      setNamespace(activeInstanceId, ns);
    }
  };

  return (
    <ResourceView isLoading={isLoading} errorMsg={errorMsg}>
      <KubeWorkspaceLayout
        header={
          <EventsToolbar
            searchQuery={searchQuery}
            caseSensitive={caseSensitive}
            useRegex={useRegex}
            totalCount={filteredData.length}
            selectedCount={selectedIds.size}
            namespaces={namespaces}
            selectedNamespace={selectedNamespace}
            onSearchChange={setSearchQuery}
            onCaseSensitiveToggle={() => setCaseSensitive((v) => !v)}
            onRegexToggle={() => setUseRegex((v) => !v)}
            onDownload={handleDownloadCsv}
            onNamespaceChange={handleNamespaceChange}
          />
        }
      >
        <EventsTable
          filteredData={filteredData}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSelectEvent={handleSelectEvent}
          selectedEventId={selectedEventId}
        />
      </KubeWorkspaceLayout>
    </ResourceView>
  );
};

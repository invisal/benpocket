import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { type ApplicationData } from '../../../types/ApplicationData';
import { ApplicationsToolbar } from './ApplicationsToolbar';
import { ApplicationsTable } from './ApplicationsTable';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';

interface ApplicationProps {
  applicationsData: ApplicationData[];
  kuberneterSelectedNamespace: string;
}

export const Application: React.FC<ApplicationProps> = ({
  applicationsData,
  kuberneterSelectedNamespace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter rows by namespace + search query
  const filteredData = useMemo(() => {
    return applicationsData.filter((app) => {
      if (
        kuberneterSelectedNamespace !== 'All Namespaces' &&
        app.namespace !== kuberneterSelectedNamespace
      ) {
        return false;
      }

      if (!searchQuery) return true;

      const fields = [
        app.instance,
        app.application,
        app.namespace,
        app.managedBy,
        app.version,
        app.status
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
  }, [applicationsData, kuberneterSelectedNamespace, searchQuery, caseSensitive, useRegex]);

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

  return (
    <KubeWorkspaceLayout
      header={
        <ApplicationsToolbar
          searchQuery={searchQuery}
          caseSensitive={caseSensitive}
          useRegex={useRegex}
          selectedCount={selectedIds.size}
          onSearchChange={setSearchQuery}
          onCaseSensitiveToggle={() => setCaseSensitive((v) => !v)}
          onRegexToggle={() => setUseRegex((v) => !v)}
        />
      }
    >
      <ApplicationsTable
        filteredData={filteredData}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
      />
    </KubeWorkspaceLayout>
  );
};

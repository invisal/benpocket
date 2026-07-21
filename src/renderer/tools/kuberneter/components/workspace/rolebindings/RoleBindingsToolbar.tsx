import type React from 'react';
import { KubeSearchbox } from '../../KubeSearchbox';
import { Download } from 'lucide-react';
import { Select } from '@renderer/components/ui/Select';

interface RoleBindingsToolbarProps {
  searchQuery: string;
  caseSensitive: boolean;
  useRegex: boolean;
  totalCount: number;
  selectedCount: number;
  namespaces: string[];
  namespace: string;
  onNamespaceChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
  onCaseSensitiveToggle: () => void;
  onRegexToggle: () => void;
  onDownload: () => void;
}

export const RoleBindingsToolbar: React.FC<RoleBindingsToolbarProps> = ({
  searchQuery,
  caseSensitive,
  useRegex,
  totalCount,
  selectedCount,
  namespaces,
  namespace,
  onNamespaceChange,
  onSearchChange,
  onCaseSensitiveToggle,
  onRegexToggle,
  onDownload
}) => {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <Select.Root value={namespace} onValueChange={onNamespaceChange}>
          <Select.Trigger variant="outline" size="sm" className="w-40 justify-between">
            <Select.Value placeholder="Select namespace" />
          </Select.Trigger>
          <Select.Content className="max-h-64 overflow-y-auto">
            {namespaces.map((ns) => (
              <Select.Item key={ns} value={ns}>
                {ns}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

        <KubeSearchbox
          value={searchQuery}
          placeholder="Search Role Bindings..."
          onChange={onSearchChange}
          className="w-64"
          showToggles
          caseSensitive={caseSensitive}
          onCaseSensitiveToggle={onCaseSensitiveToggle}
          useRegex={useRegex}
          onRegexToggle={onRegexToggle}
        />
      </div>

      <div
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer select-none"
        onClick={onDownload}
      >
        <Download className="size-3.5" />
        <span className="text-[11px] font-medium">
          {selectedCount > 0 ? `${selectedCount} / ` : ''}
          {totalCount} Items
        </span>
      </div>
    </div>
  );
};

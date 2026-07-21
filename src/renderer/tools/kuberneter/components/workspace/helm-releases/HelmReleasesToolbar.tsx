import type React from 'react';
import { KubeSearchbox } from '../../KubeSearchbox';
import { Select } from '@renderer/components/ui/Select';
import { Download, Tag } from 'lucide-react';

interface HelmReleasesToolbarProps {
  searchQuery: string;
  caseSensitive: boolean;
  useRegex: boolean;
  totalCount: number;
  selectedCount: number;
  namespace: string;
  namespaces: string[];
  onNamespaceChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onCaseSensitiveToggle: () => void;
  onRegexToggle: () => void;
  onDownload: () => void;
}

export const HelmReleasesToolbar: React.FC<HelmReleasesToolbarProps> = ({
  searchQuery,
  caseSensitive,
  useRegex,
  totalCount,
  selectedCount,
  namespace,
  namespaces,
  onNamespaceChange,
  onSearchChange,
  onCaseSensitiveToggle,
  onRegexToggle,
  onDownload
}) => {
  return (
    <div className="flex items-center justify-between w-full gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Select.Root value={namespace} onValueChange={(val) => val && onNamespaceChange(val)}>
          <Select.Trigger
            variant="outline"
            size="sm"
            icon={<Tag className="size-3.5 text-zinc-500" />}
            className="h-7 min-w-36 text-xs font-sans justify-between"
          >
            <Select.Value />
          </Select.Trigger>
          <Select.Content side="bottom" align="start">
            {namespaces.map((ns) => (
              <Select.Item key={ns} value={ns}>
                <Select.ItemText>{ns}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

        <KubeSearchbox
          value={searchQuery}
          placeholder="Search Helm Releases..."
          onChange={onSearchChange}
          className="w-72"
          showToggles
          caseSensitive={caseSensitive}
          onCaseSensitiveToggle={onCaseSensitiveToggle}
          useRegex={useRegex}
          onRegexToggle={onRegexToggle}
        />
      </div>

      <div
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer select-none shrink-0"
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

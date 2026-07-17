import type React from 'react';
import { KubeSearchbox } from '../../KubeSearchbox';
import { Download } from 'lucide-react';

interface ValidatingWebhooksToolbarProps {
  searchQuery: string;
  caseSensitive: boolean;
  useRegex: boolean;
  totalCount: number;
  selectedCount: number;
  onSearchChange: (value: string) => void;
  onCaseSensitiveToggle: () => void;
  onRegexToggle: () => void;
  onDownload: () => void;
}

export const ValidatingWebhooksToolbar: React.FC<ValidatingWebhooksToolbarProps> = ({
  searchQuery,
  caseSensitive,
  useRegex,
  totalCount,
  selectedCount,
  onSearchChange,
  onCaseSensitiveToggle,
  onRegexToggle,
  onDownload
}) => {
  return (
    <div className="flex items-center justify-between w-full">
      <KubeSearchbox
        value={searchQuery}
        placeholder="Search Validating Webhook Configurations..."
        onChange={onSearchChange}
        className="w-72"
        showToggles
        caseSensitive={caseSensitive}
        onCaseSensitiveToggle={onCaseSensitiveToggle}
        useRegex={useRegex}
        onRegexToggle={onRegexToggle}
      />

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

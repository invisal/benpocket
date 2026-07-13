import React from 'react';
import { KubeSearchbox } from '../../KubeSearchbox';
import { Download } from 'lucide-react';

interface JobsToolbarProps {
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

export const JobsToolbar: React.FC<JobsToolbarProps> = ({
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
        placeholder="Search Jobs..."
        onChange={onSearchChange}
        className="w-64"
        showToggles
        caseSensitive={caseSensitive}
        onCaseSensitiveToggle={onCaseSensitiveToggle}
        useRegex={useRegex}
        onRegexToggle={onRegexToggle}
      />
      <div
        className="flex items-center gap-1.5 text-zinc-555 hover:text-zinc-350 transition-colors cursor-pointer select-none"
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

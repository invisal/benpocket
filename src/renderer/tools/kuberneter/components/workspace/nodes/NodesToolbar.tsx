import React from 'react';
import { KubeSearchbox } from '../../KubeSearchbox';
import { Download } from 'lucide-react';

interface NodesToolbarProps {
  searchQuery: string;
  caseSensitive: boolean;
  useRegex: boolean;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onCaseSensitiveToggle: () => void;
  onRegexToggle: () => void;
  onDownload: () => void;
}

export const NodesToolbar: React.FC<NodesToolbarProps> = ({
  searchQuery,
  caseSensitive,
  useRegex,
  totalCount,
  onSearchChange,
  onCaseSensitiveToggle,
  onRegexToggle,
  onDownload
}) => {
  return (
    <div className="flex items-center justify-between w-full">
      <KubeSearchbox
        value={searchQuery}
        placeholder="Search Nodes..."
        onChange={onSearchChange}
        className="w-64"
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
        <span className="text-[11px] font-medium">{totalCount} Items</span>
      </div>
    </div>
  );
};

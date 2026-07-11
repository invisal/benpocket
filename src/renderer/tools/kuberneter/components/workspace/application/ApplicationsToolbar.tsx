import React from 'react';
import { cn } from 'cnfast';
import { KubeSearchbox } from '../../KubeSearchbox';

interface ApplicationsToolbarProps {
  searchQuery: string;
  caseSensitive: boolean;
  useRegex: boolean;
  selectedCount: number;
  onSearchChange: (value: string) => void;
  onCaseSensitiveToggle: () => void;
  onRegexToggle: () => void;
}

export const ApplicationsToolbar: React.FC<ApplicationsToolbarProps> = ({
  searchQuery,
  caseSensitive,
  useRegex,
  selectedCount,
  onSearchChange,
  onCaseSensitiveToggle,
  onRegexToggle
}) => {
  return (
    <div className="flex items-center justify-between shrink-0">
      <KubeSearchbox
        value={searchQuery}
        placeholder="Search Applications..."
        onChange={onSearchChange}
        className="w-64"
        showToggles
        caseSensitive={caseSensitive}
        onCaseSensitiveToggle={onCaseSensitiveToggle}
        useRegex={useRegex}
        onRegexToggle={onRegexToggle}
      />

      {selectedCount > 0 && (
        <span className={cn('text-[11px] text-zinc-550 font-sans')}>
          {selectedCount} row{selectedCount > 1 ? 's' : ''} selected
        </span>
      )}
    </div>
  );
};

import React from 'react';
import { Search } from 'lucide-react';
import { cn } from 'cnfast';
import { Input } from '../../../src/components/ui/Input';

interface KubeSearchboxProps {
  /** The current search query value */
  value: string;
  /** Placeholder text shown when input is empty */
  placeholder?: string;
  /** Called when the input value changes */
  onChange: (value: string) => void;
  /** Additional class names for the root container */
  className?: string;

  // --- Optional toggle controls (VS Code style) ---
  /** Whether to render the Aa / .* toggle buttons inside the input */
  showToggles?: boolean;
  /** Current state of the case-sensitive toggle */
  caseSensitive?: boolean;
  /** Called when the Aa button is clicked */
  onCaseSensitiveToggle?: () => void;
  /** Current state of the regex toggle */
  useRegex?: boolean;
  /** Called when the .* button is clicked */
  onRegexToggle?: () => void;
}

export const KubeSearchbox: React.FC<KubeSearchboxProps> = ({
  value,
  placeholder = 'Search...',
  onChange,
  className,
  showToggles = false,
  caseSensitive = false,
  onCaseSensitiveToggle,
  useRegex = false,
  onRegexToggle
}) => {
  const hasToggles = showToggles && (onCaseSensitiveToggle || onRegexToggle);

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 z-10 pointer-events-none" />
      <Input
        size="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'bg-surface border-border-dark text-[11px] text-zinc-300 placeholder:text-zinc-600',
          'focus:border-accent transition-colors font-sans',
          hasToggles ? 'pl-8 pr-16' : 'pl-8 pr-3'
        )}
      />
      {hasToggles && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {onCaseSensitiveToggle && (
            <button
              type="button"
              onClick={onCaseSensitiveToggle}
              title="Match Case (Aa)"
              className={cn(
                'px-1 py-0.5 rounded text-[10px] font-semibold border border-transparent',
                'hover:bg-surface-3 transition-colors cursor-pointer',
                caseSensitive ? 'bg-accent/20 text-accent border-accent/40' : 'text-zinc-500'
              )}
            >
              Aa
            </button>
          )}
          {onRegexToggle && (
            <button
              type="button"
              onClick={onRegexToggle}
              title="Use Regular Expression (.*)"
              className={cn(
                'px-1 py-0.5 rounded text-[10px] font-semibold border border-transparent',
                'hover:bg-surface-3 transition-colors cursor-pointer',
                useRegex ? 'bg-accent/20 text-accent border-accent/40' : 'text-zinc-500'
              )}
            >
              .*
            </button>
          )}
        </div>
      )}
    </div>
  );
};

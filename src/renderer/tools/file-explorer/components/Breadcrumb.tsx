import { ChevronRight } from 'lucide-react';
import { cn } from 'cnfast';
import { splitPathSegments } from '../lib/paths';

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({ currentPath, onNavigate }: BreadcrumbProps) {
  const segments = splitPathSegments(currentPath);

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border-dark bg-surface-2 text-xs overflow-x-auto shrink-0 select-none">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={segment.path} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight size={12} className="text-zinc-600 shrink-0" />}
            <button
              onClick={() => onNavigate(segment.path)}
              disabled={isLast}
              className={cn(
                'px-1.5 py-0.5 rounded max-w-48 truncate',
                isLast
                  ? 'text-text-base font-medium cursor-default'
                  : 'text-text-dim cursor-pointer hover:bg-surface-4'
              )}
            >
              {segment.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

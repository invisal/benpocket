import type { JSX } from 'react';
import { cn } from '../../lib/utils';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { EDITOR_TOOLS, type EditorTool } from './editorTools';

interface EditorToolRailProps {
  active: EditorTool | null;
  onSelect: (tool: EditorTool) => void;
}

export function EditorToolRail({ active, onSelect }: EditorToolRailProps): JSX.Element {
  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      <nav className="flex w-14 shrink-0 flex-col items-center gap-0.5 border-r border-line bg-surface py-3">
        {EDITOR_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = active === tool.id;
          return (
            <Tooltip.Root key={tool.id}>
              <Tooltip.Trigger
                render={
                  <button
                    onClick={() => onSelect(tool.id)}
                    aria-label={tool.label}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
                      isActive
                        ? 'bg-accent/15 text-accent'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </button>
                }
              />
              <Tooltip.Content side="right">{tool.label}</Tooltip.Content>
            </Tooltip.Root>
          );
        })}
      </nav>
    </Tooltip.Provider>
  );
}

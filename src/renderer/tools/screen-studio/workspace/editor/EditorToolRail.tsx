import type { JSX } from 'react';
import {
  Captions,
  Download,
  Image,
  MousePointer2,
  Video,
  ZoomIn,
  type LucideIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type EditorTool = 'background' | 'cursor' | 'webcam' | 'captions' | 'zoom' | 'export';

export const EDITOR_TOOLS: { id: EditorTool; label: string; icon: LucideIcon }[] = [
  { id: 'background', label: 'Background', icon: Image },
  { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { id: 'webcam', label: 'Webcam', icon: Video },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'export', label: 'Export', icon: Download }
];

interface EditorToolRailProps {
  active: EditorTool | null;
  onSelect: (tool: EditorTool) => void;
}

/** Vertical icon rail that switches which contextual tool panel is shown next to the preview. */
export function EditorToolRail({ active, onSelect }: EditorToolRailProps): JSX.Element {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface-sunken py-3">
      {EDITOR_TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = active === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelect(tool.id)}
            title={tool.label}
            aria-label={tool.label}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-accent/15 text-accent'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        );
      })}
    </nav>
  );
}

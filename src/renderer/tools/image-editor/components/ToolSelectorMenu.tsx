import {
  ChevronDown,
  Crop,
  Eraser,
  Eye,
  Maximize2,
  Scissors,
  Sparkles,
  Wand2,
  ZoomIn,
  type LucideIcon
} from 'lucide-react';
import { Menu } from '@renderer/components/ui/Menu';
import { Toolbar } from '@renderer/components/ui/Toolbar';
import type { ImageToolId } from '../types';

const TOOLS: { id: ImageToolId; label: string; icon: LucideIcon }[] = [
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'generative', label: 'Generative', icon: Sparkles },
  { id: 'resize', label: 'Resize', icon: Maximize2 },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'upscale', label: 'Upscale', icon: ZoomIn },
  { id: 'bg-remove', label: 'Remove Background', icon: Scissors },
  { id: 'context-resize', label: 'Content-Aware Expand', icon: Wand2 },
  { id: 'context-removal', label: 'Content-Aware Fill', icon: Eraser }
];

interface ToolSelectorMenuProps {
  active: ImageToolId;
  onSelect: (tool: ImageToolId) => void;
}

/** Leftmost item of each tool's own toolbar -- lets the user switch tools from a dropdown instead
 * of a separate icon rail. */
export function ToolSelectorMenu({ active, onSelect }: ToolSelectorMenuProps) {
  const current = TOOLS.find((t) => t.id === active) ?? TOOLS[0];
  const CurrentIcon = current.icon;

  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Toolbar.Button>
            <CurrentIcon size={13} strokeWidth={1.75} />
            {current.label}
            <ChevronDown size={12} />
          </Toolbar.Button>
        }
      />
      <Menu.Content align="start">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Menu.Item key={tool.id} onClick={() => onSelect(tool.id)}>
              <Icon size={13} strokeWidth={1.75} />
              {tool.label}
            </Menu.Item>
          );
        })}
      </Menu.Content>
    </Menu.Root>
  );
}

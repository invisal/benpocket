import {
  Droplets,
  Gauge,
  Palette,
  MousePointer2,
  ZoomIn,
  Pencil,
  type LucideIcon,
  Camera
} from 'lucide-react';
import type { AspectRatio } from '@screen-recorder/types/export';

export type EditorTool =
  'background' | 'cursor' | 'webcam' | 'captions' | 'annotations' | 'blur-mask' | 'zoom' | 'clip';

export const EDITOR_TOOLS: { id: EditorTool; label: string; icon: LucideIcon }[] = [
  { id: 'background', label: 'Background', icon: Palette },
  { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { id: 'webcam', label: 'Webcam', icon: Camera },
  { id: 'annotations', label: 'Annotations', icon: Pencil },
  { id: 'blur-mask', label: 'Blur/Mask', icon: Droplets },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'clip', label: 'Clip', icon: Gauge }
];

export const ASPECT_RATIO_VALUES: Record<AspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3
};

export const ASPECT_LABELS: Record<AspectRatio, string> = {
  '16:9': 'Wide 16:9',
  '9:16': 'Vertical 9:16',
  '1:1': 'Square 1:1',
  '4:3': 'Standard 4:3'
};

export const PENDING_SWAP_TIMEOUT_MS = 400;

export const TOOL_PANEL_MIN_WIDTH = 220;
export const TOOL_PANEL_MAX_WIDTH = 420;
export const EDITOR_TOOL_RAIL_WIDTH_PX = 56;

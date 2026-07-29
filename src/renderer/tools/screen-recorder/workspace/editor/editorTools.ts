import {
  Droplets,
  Gauge,
  Palette,
  MousePointer2,
  Video,
  ZoomIn,
  Pencil,
  type LucideIcon
} from 'lucide-react';

export type EditorTool =
  'background' | 'cursor' | 'webcam' | 'captions' | 'annotations' | 'blur-mask' | 'zoom' | 'clip';

export const EDITOR_TOOLS: { id: EditorTool; label: string; icon: LucideIcon }[] = [
  { id: 'background', label: 'Background', icon: Palette },
  { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { id: 'webcam', label: 'Webcam', icon: Video },
  { id: 'annotations', label: 'Annotations', icon: Pencil },
  { id: 'blur-mask', label: 'Blur/Mask', icon: Droplets },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'clip', label: 'Clip', icon: Gauge }
];

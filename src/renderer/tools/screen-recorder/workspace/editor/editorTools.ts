import {
  // Captions,
  Droplets,
  Gauge,
  Image,
  MousePointer2,
  PenTool,
  Video,
  ZoomIn,
  type LucideIcon
} from 'lucide-react';

export type EditorTool =
  'background' | 'cursor' | 'webcam' | 'captions' | 'annotations' | 'blur-mask' | 'zoom' | 'clip';

export const EDITOR_TOOLS: { id: EditorTool; label: string; icon: LucideIcon }[] = [
  { id: 'background', label: 'Background', icon: Image },
  { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { id: 'webcam', label: 'Webcam', icon: Video },
  // { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'annotations', label: 'Annotations', icon: PenTool },
  { id: 'blur-mask', label: 'Blur/Mask', icon: Droplets },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'clip', label: 'Clip', icon: Gauge }
];

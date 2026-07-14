import {
  Captions,
  Download,
  Gauge,
  Image,
  MousePointer2,
  PenTool,
  Video,
  ZoomIn,
  type LucideIcon
} from 'lucide-react';

export type EditorTool =
  'background' | 'cursor' | 'webcam' | 'captions' | 'annotations' | 'zoom' | 'clip' | 'export';

export const EDITOR_TOOLS: { id: EditorTool; label: string; icon: LucideIcon }[] = [
  { id: 'background', label: 'Background', icon: Image },
  { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { id: 'webcam', label: 'Webcam', icon: Video },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'annotations', label: 'Annotations', icon: PenTool },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'clip', label: 'Clip', icon: Gauge },
  { id: 'export', label: 'Export', icon: Download }
];

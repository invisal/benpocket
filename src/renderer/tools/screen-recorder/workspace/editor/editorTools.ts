import {
  Captions,
  Download,
  Image,
  MousePointer2,
  Video,
  ZoomIn,
  type LucideIcon
} from 'lucide-react';

export type EditorTool = 'background' | 'cursor' | 'webcam' | 'captions' | 'zoom' | 'export';

export const EDITOR_TOOLS: { id: EditorTool; label: string; icon: LucideIcon }[] = [
  { id: 'background', label: 'Background', icon: Image },
  { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { id: 'webcam', label: 'Webcam', icon: Video },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'export', label: 'Export', icon: Download }
];

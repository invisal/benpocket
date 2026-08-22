import { Activity, type JSX } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import type { SourceResolution } from '@screen-recorder/types/editor';
import { BackgroundPicker } from '../../features/background/components/BackgroundPicker';
import { CursorSettingsPanel } from '../../features/cursor/components/CursorSettingsPanel';
import { WebcamPanel } from '../../features/webcam/components/WebcamPanel';
import { CaptionsPanel } from '../../features/captions/components/CaptionsPanel';
import { AnnotationsPanel } from '../../features/annotations/components/AnnotationsPanel';
import { BlurMaskPanel } from '../../features/blur-mask/components/BlurMaskPanel';
import { ZoomKeyframeEditor } from '../../features/zoom/components/ZoomKeyframeEditor';
import { ClipSettingsPanel } from '../../features/timeline/components/ClipSettingsPanel';
import { isLikelyLinux } from '../../lib/platform';
import { type EditorTool } from './editorTools';

interface EditorToolPanelProps {
  tool: EditorTool;
  currentTimeMs: number;
  sourceResolution: SourceResolution | null;
  selectedSegment: TimelineSegment | null;
  /** Imported footage has no recorded cursor/click samples, so the Cursor tool has nothing to control -- hide its panel entirely rather than leave it open with no real effect. */
  isImportedProject: boolean;
}
const tools = [
  {
    id: 'background',
    label: 'Background',
    component: BackgroundPicker
  },
  { id: 'cursor', label: 'Cursor', component: CursorSettingsPanel },
  { id: 'webcam', label: 'Webcam', component: WebcamPanel },
  { id: 'captions', label: 'Captions', component: CaptionsPanel },
  { id: 'annotations', label: 'Annotations', component: AnnotationsPanel },
  { id: 'blur-mask', label: 'Blur/Mask', component: BlurMaskPanel },
  { id: 'zoom', label: 'Zoom', component: ZoomKeyframeEditor },
  { id: 'clip', label: 'Clip', component: ClipSettingsPanel }
] as const;

export function EditorToolPanel({
  tool,
  currentTimeMs,
  sourceResolution,
  selectedSegment,
  isImportedProject
}: EditorToolPanelProps): JSX.Element {
  // Same reasoning as EditorToolRail.tsx's identical filter.
  const visibleTools =
    isImportedProject || isLikelyLinux ? tools.filter((t) => t.id !== 'cursor') : tools;
  const label = visibleTools.find((t) => t.id === tool)?.label ?? '';
  return (
    <aside className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto border-l border-line p-3">
      <h2 className="font-semibold text-foreground">{label}</h2>
      {visibleTools.map((t) => {
        const Component = t.component;
        return (
          <Activity key={t.id} mode={t.id === tool ? 'visible' : 'hidden'}>
            <Component
              currentTimeMs={currentTimeMs}
              sourceResolution={sourceResolution}
              segment={selectedSegment}
            />
          </Activity>
        );
      })}
    </aside>
  );
}

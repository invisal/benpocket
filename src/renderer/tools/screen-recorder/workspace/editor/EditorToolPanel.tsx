import type { JSX } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import { BackgroundPicker } from '../../features/background/components/BackgroundPicker';
import { CursorSettingsPanel } from '../../features/cursor/components/CursorSettingsPanel';
import { WebcamPanel } from '../../features/webcam/components/WebcamPanel';
import { CaptionsPanel } from '../../features/captions/components/CaptionsPanel';
import { AnnotationsPanel } from '../../features/annotations/components/AnnotationsPanel';
import { BlurMaskPanel } from '../../features/blur-mask/components/BlurMaskPanel';
import { ZoomKeyframeEditor } from '../../features/zoom/components/ZoomKeyframeEditor';
import { ClipSettingsPanel } from '../../features/timeline/components/ClipSettingsPanel';
import { ExportSidePanel } from '../../features/export/components/ExportSidePanel';
import { EDITOR_TOOLS, type EditorTool } from './editorTools';

interface EditorToolPanelProps {
  tool: EditorTool;
  currentTimeMs: number;
  sourceResolution: { width: number; height: number } | null;
  selectedSegment: TimelineSegment | null;
}

export function EditorToolPanel({
  tool,
  currentTimeMs,
  sourceResolution,
  selectedSegment
}: EditorToolPanelProps): JSX.Element {
  if (tool === 'export') return <ExportSidePanel />;

  const label = EDITOR_TOOLS.find((t) => t.id === tool)?.label ?? '';

  return (
    <aside className="flex w-70 shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      {tool === 'background' && <BackgroundPicker />}
      {tool === 'cursor' && <CursorSettingsPanel />}
      {tool === 'webcam' && <WebcamPanel />}
      {tool === 'captions' && <CaptionsPanel />}
      {tool === 'annotations' && <AnnotationsPanel currentTimeMs={currentTimeMs} />}
      {tool === 'blur-mask' && <BlurMaskPanel currentTimeMs={currentTimeMs} />}
      {tool === 'zoom' && (
        <ZoomKeyframeEditor currentTimeMs={currentTimeMs} sourceResolution={sourceResolution} />
      )}
      {tool === 'clip' && <ClipSettingsPanel segment={selectedSegment} />}
    </aside>
  );
}

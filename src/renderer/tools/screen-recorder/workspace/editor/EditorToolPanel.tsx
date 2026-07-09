import type { JSX } from 'react';
import { BackgroundPicker } from '../../features/background/components/BackgroundPicker';
import { CursorSettingsPanel } from '../../features/cursor/components/CursorSettingsPanel';
import { WebcamPanel } from '../../features/webcam/components/WebcamPanel';
import { CaptionsPanel } from '../../features/captions/components/CaptionsPanel';
import { ZoomKeyframeEditor } from '../../features/zoom/components/ZoomKeyframeEditor';
import { ExportSidePanel } from '../../features/export/components/ExportSidePanel';
import { EDITOR_TOOLS, type EditorTool } from './editorTools';

interface EditorToolPanelProps {
  tool: EditorTool;
  currentTimeMs: number;
}

/** Renders whichever tool's settings the EditorToolRail has selected. */
export function EditorToolPanel({ tool, currentTimeMs }: EditorToolPanelProps): JSX.Element {
  if (tool === 'export') return <ExportSidePanel />;

  const label = EDITOR_TOOLS.find((t) => t.id === tool)?.label ?? '';

  return (
    <aside className="flex w-70 shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-surface-sunken p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</h2>
      {tool === 'background' && <BackgroundPicker />}
      {tool === 'cursor' && <CursorSettingsPanel />}
      {tool === 'webcam' && <WebcamPanel />}
      {tool === 'captions' && <CaptionsPanel />}
      {tool === 'zoom' && <ZoomKeyframeEditor currentTimeMs={currentTimeMs} />}
    </aside>
  );
}

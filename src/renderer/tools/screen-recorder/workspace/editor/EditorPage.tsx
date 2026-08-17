import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useScreenRecorderStore } from '../../store/screen-recorder-store';
import {
  useTimelineStore,
  PRIMARY_VIDEO_TRACK_ID
} from '../../features/timeline/store/timeline-store';
import { useHistoryStore } from '../../features/history/store/history-store';
import { useZoomStore } from '../../features/zoom/store/zoom-store';
import { useAnnotationsStore } from '../../features/annotations/store/annotations-store';
import { useBlurMaskStore } from '../../features/blur-mask/store/blur-mask-store';
import { PreviewStage } from './PreviewStage';
import { EditorTransportBar } from './EditorTransportBar';
import { EditorToolRail } from './EditorToolRail';
import { EditorToolPanel } from './EditorToolPanel';
import EditorEmpty from './EditorEmpty';
import { CropDialog } from '../../features/crop/components/CropDialog';
import { useCropStore } from '../../features/crop/store/crop-store';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import type { PreviewVideoController, SourceResolution } from '@screen-recorder/types/editor';
import {
  TOOL_PANEL_MIN_WIDTH,
  TOOL_PANEL_MAX_WIDTH,
  EDITOR_TOOL_RAIL_WIDTH_PX
} from './editorTools';
import { useSyncSelectedSegment } from './hooks/use-sync-selected-segment';
import { useApplySeekRequest } from './hooks/use-apply-seek-request';
import { useInitializeTimelineForRecording } from './hooks/use-initialize-timeline-for-recording';
import { useEditorKeyboardShortcuts } from './hooks/use-editor-keyboard-shortcuts';
import { isLikelyLinux } from '../../lib/platform';

export function EditorPage(): JSX.Element {
  const lastRecording = useScreenRecorderStore((state) => state.lastRecording);
  const isOpeningProject = useScreenRecorderStore((state) => state.isOpeningProject);
  const toolPanelWidth = useScreenRecorderStore((state) => state.toolPanelWidth);
  const setToolPanelWidth = useScreenRecorderStore((state) => state.setToolPanelWidth);

  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const initializeFromDuration = useTimelineStore((s) => s.initializeFromDuration);
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useTimelineStore((s) => s.setSelectedSegmentId);
  const activeTool = useTimelineStore((s) => s.activeTool);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  const seekRequestMs = useTimelineStore((s) => s.seekRequestMs);
  const clearSeekRequest = useTimelineStore((s) => s.clearSeekRequest);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const crop = useCropStore((s) => s.rect);
  // Whether a zoom keyframe/annotation/blur-mask region is explicitly
  // selected instead of a clip -- see use-sync-selected-segment.ts's
  // `hasOtherSelection` doc for why this has to suppress its auto-select
  // fallback.
  const selectedKeyframeId = useZoomStore((s) => s.selectedKeyframeId);
  const selectedAnnotationId = useAnnotationsStore((s) => s.selectedAnnotationId);
  const selectedRegionId = useBlurMaskStore((s) => s.selectedRegionId);

  const [duration, setDuration] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [sourceResolution, setSourceResolution] = useState<SourceResolution | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<PreviewVideoController>(null);

  useSyncSelectedSegment({
    segments,
    selectedSegmentId,
    setSelectedSegmentId,
    hasOtherSelection: Boolean(selectedKeyframeId || selectedAnnotationId || selectedRegionId)
  });
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) ?? null;

  useApplySeekRequest({ videoRef, seekRequestMs, clearSeekRequest });
  // `pauseRequestToken` (bumped by e.g. ExportDialogButton, a nav-bar
  // sibling of this page that can't reach `videoRef` directly) -- same
  // subscribe-not-read shape as ScreenRecorderApp.tsx's `saveRequestToken`
  // handling, so the pause fires from within the subscription callback
  // rather than needing this whole component to re-render on every bump.
  useEffect(() => {
    return useTimelineStore.subscribe((state, prevState) => {
      if (state.pauseRequestToken === prevState.pauseRequestToken) return;
      videoRef.current?.pause();
    });
  }, []);
  useInitializeTimelineForRecording({
    previewUrl: lastRecording?.previewUrl,
    durationSec: duration,
    initializeFromDuration
  });
  useEditorKeyboardShortcuts({ videoRef, undo, redo });

  // Imported footage never has recorded cursor/click samples, so the Cursor
  // tool has nothing real to show or control -- its tab is hidden below.
  // Steer away from it here too, for whichever project was open (or tab was
  // selected) right before this one loaded. Same for Linux, where cursor/
  // click tracking is always skipped (see useRecordingController.ts) --
  // even a 'recorded' project has an empty cursor path there.
  const isImportedProject = lastRecording?.source === 'imported';
  useEffect(() => {
    if ((isImportedProject || isLikelyLinux) && activeTool === 'cursor') {
      setActiveTool('background');
    }
  }, [isImportedProject, activeTool, setActiveTool]);

  if (!lastRecording && !isOpeningProject) {
    return <EditorEmpty />;
  }

  function handleLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>): void {
    const video = event.currentTarget;
    setDuration(video.duration);
    const resolution = { width: video.videoWidth, height: video.videoHeight };
    setSourceResolution(resolution);
    // Also mirrored into the app store -- see its `sourceResolution` doc for
    // why useExportAction.ts (outside this component entirely) needs it too.
    useScreenRecorderStore.getState().setSourceResolution(resolution);
  }

  return (
    <div className="flex min-h-0 flex-1 gap-1 dark:gap-1.5">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface">
        <PreviewStage
          key={lastRecording?.previewUrl}
          videoRef={videoRef}
          previewUrl={lastRecording?.previewUrl}
          isPlaying={isPlaying}
          videoError={videoError}
          currentTimeMs={currentTimeMs}
          sourceResolution={sourceResolution}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={setVideoError}
          onTimeUpdate={setCurrentTimeMs}
        />

        <EditorTransportBar
          videoRef={videoRef}
          isPlaying={isPlaying}
          hasCrop={Boolean(crop)}
          onOpenCrop={() => setIsCropDialogOpen(true)}
          currentTimeMs={currentTimeMs}
          durationMs={duration * 1000}
        />
      </div>

      {sourceResolution && lastRecording && (
        <CropDialog
          key={String(isCropDialogOpen)}
          open={isCropDialogOpen}
          onOpenChange={setIsCropDialogOpen}
          sourceWidth={sourceResolution.width}
          sourceHeight={sourceResolution.height}
          previewUrl={lastRecording.previewUrl}
          currentTimeMs={currentTimeMs}
        />
      )}

      {activeTool ? (
        <ResizablePanel
          edge="left"
          size={EDITOR_TOOL_RAIL_WIDTH_PX + toolPanelWidth}
          onResize={(size) => setToolPanelWidth(size - EDITOR_TOOL_RAIL_WIDTH_PX)}
          min={EDITOR_TOOL_RAIL_WIDTH_PX + TOOL_PANEL_MIN_WIDTH}
          max={EDITOR_TOOL_RAIL_WIDTH_PX + TOOL_PANEL_MAX_WIDTH}
          className="flex overflow-hidden rounded-lg border border-line bg-surface"
          handleClassName="z-40"
        >
          <EditorToolRail
            active={activeTool}
            onSelect={(tool) => setActiveTool(activeTool === tool ? null : tool)}
            isImportedProject={isImportedProject}
          />
          <EditorToolPanel
            tool={activeTool}
            currentTimeMs={currentTimeMs}
            sourceResolution={sourceResolution}
            selectedSegment={selectedSegment}
            isImportedProject={isImportedProject}
          />
        </ResizablePanel>
      ) : (
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
          <EditorToolRail
            active={activeTool}
            onSelect={(tool) => setActiveTool(tool)}
            isImportedProject={isImportedProject}
          />
        </div>
      )}
    </div>
  );
}

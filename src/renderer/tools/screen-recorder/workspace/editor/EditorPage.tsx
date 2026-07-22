import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/app-store';
import {
  useTimelineStore,
  PRIMARY_VIDEO_TRACK_ID
} from '../../features/timeline/store/timeline-store';
import { resetHistory, useHistoryStore } from '../../features/history/store/history-store';
import { PreviewStage, type PreviewVideoController } from './PreviewStage';
import { EditorTransportBar } from './EditorTransportBar';
import { EditorToolRail } from './EditorToolRail';
import { EditorToolPanel } from './EditorToolPanel';

export function EditorPage(): JSX.Element {
  const lastRecording = useAppStore((state) => state.lastRecording);

  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const initializeFromDuration = useTimelineStore((s) => s.initializeFromDuration);
  // Selection/active-tool live in the timeline store (not local state) so
  // they're shared with CutTimeline and its per-tool tracks, which are
  // rendered independently in ScreenRecorderApp rather than nested inside
  // this page -- see CutTimeline.tsx. E.g. clicking a zoom keyframe pill
  // needs to open the Zoom panel here, from outside this component tree.
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useTimelineStore((s) => s.setSelectedSegmentId);
  const activeTool = useTimelineStore((s) => s.activeTool);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  const isCutToolActive = useTimelineStore((s) => s.isCutToolActive);
  const setCutToolActive = useTimelineStore((s) => s.setCutToolActive);
  const seekRequestMs = useTimelineStore((s) => s.seekRequestMs);
  const clearSeekRequest = useTimelineStore((s) => s.clearSeekRequest);
  // Lives in the timeline store (not local state) for the same reason
  // selection/activeTool do -- CutTimeline (rendered independently, see
  // above) needs to read play state too, to gate the ruler's hover-scrub
  // (only live-previews while paused; see CutTimeline.tsx).
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  const [duration, setDuration] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [cropToolActive, setCropToolActive] = useState(false);
  const [sourceResolution, setSourceResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<PreviewVideoController>(null);

  // Default the crop tool's selection to the first clip once segments exist,
  // and drop the selection if that clip gets deleted/reordered away.
  useEffect(() => {
    if (segments.length === 0) {
      if (selectedSegmentId !== null) setSelectedSegmentId(null);
    } else if (!segments.some((s) => s.id === selectedSegmentId)) {
      setSelectedSegmentId(segments[0].id);
    }
  }, [segments, selectedSegmentId, setSelectedSegmentId]);

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) ?? null;

  // CutTimeline can't reach `videoRef` directly (it's rendered independently
  // in ScreenRecorderApp), so it posts a one-shot seek request instead of
  // seeking the video itself -- apply it here and clear it so it doesn't
  // reapply on every render or fight the video's own `timeupdate` reports.
  useEffect(() => {
    if (seekRequestMs === null) return;
    const video = videoRef.current;
    if (video) video.currentTime = seekRequestMs / 1000;
    clearSeekRequest();
  }, [seekRequestMs, clearSeekRequest]);

  // Re-initialize the cut timeline whenever a *different* recording loads.
  // Guarded on previewUrl so scrubbing/metadata re-fires don't wipe cuts the
  // user already made on the current recording. Undo/redo history is scoped
  // to this same session boundary -- otherwise Undo could reach back past
  // the fresh recording into whatever the previous one's edits looked like.
  useEffect(() => {
    if (lastRecording && duration > 0) {
      initializeFromDuration(duration * 1000);
      resetHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRecording?.previewUrl, duration]);

  // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (or Ctrl+Y) drive undo/redo from
  // anywhere in the editor -- skipped while a text field has focus so it
  // doesn't hijack native text-undo in caption/annotation text inputs.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      const isRedo = key === 'y' || (key === 'z' && event.shiftKey);
      const isUndo = key === 'z' && !event.shiftKey;
      if (!isUndo && !isRedo) return;

      const target = event.target as HTMLElement | null;
      const isEditingText =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isEditingText) return;

      event.preventDefault();
      if (isRedo) redo();
      else undo();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  if (!lastRecording) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Record something first, then come back here to export it.
        </p>
      </div>
    );
  }

  function handleLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>): void {
    const video = event.currentTarget;
    setDuration(video.duration);
    setSourceResolution({ width: video.videoWidth, height: video.videoHeight });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PreviewStage
          // Remounts the whole stage (and both internal <video> elements,
          // see PreviewStage's dual-buffer comment) on a genuinely new
          // recording, so all of its playback bookkeeping starts fresh
          // instead of needing a manual reset effect.
          key={lastRecording.previewUrl}
          videoRef={videoRef}
          previewUrl={lastRecording.previewUrl}
          isPlaying={isPlaying}
          videoError={videoError}
          currentTimeMs={currentTimeMs}
          cropToolActive={cropToolActive}
          selectedSegmentId={selectedSegmentId}
          sourceResolution={sourceResolution}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={setVideoError}
          onTimeUpdate={setCurrentTimeMs}
        />

        {selectedSegment?.crop && (
          <p className="shrink-0 px-6 pb-1 text-xs text-muted-foreground">
            Crop: {Math.round(selectedSegment.crop.width * 100)}% ×{' '}
            {Math.round(selectedSegment.crop.height * 100)}% of frame for this clip -- applied at
            export.
          </p>
        )}

        <EditorTransportBar
          videoRef={videoRef}
          isPlaying={isPlaying}
          cropToolActive={cropToolActive}
          onToggleCrop={() => setCropToolActive((v) => !v)}
          cutToolActive={isCutToolActive}
          onToggleCutTool={() => setCutToolActive(!isCutToolActive)}
          currentTimeMs={currentTimeMs}
          durationMs={duration * 1000}
        />
      </div>

      <EditorToolRail
        active={activeTool}
        onSelect={(tool) => setActiveTool(activeTool === tool ? null : tool)}
      />
      {activeTool && (
        <EditorToolPanel
          tool={activeTool}
          currentTimeMs={currentTimeMs}
          sourceResolution={sourceResolution}
          selectedSegment={selectedSegment}
        />
      )}
    </div>
  );
}

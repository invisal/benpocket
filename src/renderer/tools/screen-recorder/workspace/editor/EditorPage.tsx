import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/app-store';
import {
  useTimelineStore,
  PRIMARY_VIDEO_TRACK_ID
} from '../../features/timeline/store/timeline-store';
import { getSegmentOutputDurationMs } from '../../features/timeline/lib/segment-duration';
import { PreviewStage } from './PreviewStage';
import { EditorTransportBar } from './EditorTransportBar';
import { EditorToolRail } from './EditorToolRail';
import { EditorToolPanel } from './EditorToolPanel';

export function EditorPage(): JSX.Element {
  const lastRecording = useAppStore((state) => state.lastRecording);

  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const initializeFromDuration = useTimelineStore((s) => s.initializeFromDuration);
  const splitAt = useTimelineStore((s) => s.splitAt);
  // Selection/active-tool live in the timeline store (not local state) so
  // they're shared with CutTimeline and its per-tool tracks, which are
  // rendered independently in ScreenRecorderApp rather than nested inside
  // this page -- see CutTimeline.tsx. E.g. clicking a zoom keyframe pill
  // needs to open the Zoom panel here, from outside this component tree.
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const setSelectedSegmentId = useTimelineStore((s) => s.setSelectedSegmentId);
  const activeTool = useTimelineStore((s) => s.activeTool);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  const seekRequestMs = useTimelineStore((s) => s.seekRequestMs);
  const clearSeekRequest = useTimelineStore((s) => s.clearSeekRequest);

  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [cropToolActive, setCropToolActive] = useState(false);
  const [sourceResolution, setSourceResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
  // user already made on the current recording.
  useEffect(() => {
    if (lastRecording && duration > 0) {
      initializeFromDuration(duration * 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRecording?.previewUrl, duration]);

  if (!lastRecording) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-white/40">
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

  function handleSplitSelected(): void {
    if (!selectedSegment) return;
    const index = segments.findIndex((s) => s.id === selectedSegment.id);
    const outputStart = segments
      .slice(0, index)
      .reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
    const outputDurationMs = getSegmentOutputDurationMs(selectedSegment);
    splitAt(outputStart + outputDurationMs / 2);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PreviewStage
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
          <p className="shrink-0 px-6 pb-1 text-xs text-white/40">
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
          onSplitSelected={handleSplitSelected}
          canSplitSelected={Boolean(selectedSegment)}
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

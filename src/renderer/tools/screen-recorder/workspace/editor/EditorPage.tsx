import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/app-store';
import { CutTimeline } from '../../features/timeline/components/CutTimeline';
import {
  useTimelineStore,
  PRIMARY_VIDEO_TRACK_ID
} from '../../features/timeline/store/timeline-store';
import { PreviewStage } from './PreviewStage';
import { EditorTransportBar } from './EditorTransportBar';
import { EditorToolRail } from './EditorToolRail';
import { EditorToolPanel } from './EditorToolPanel';
import type { EditorTool } from './editorTools';

export function EditorPage(): JSX.Element {
  const lastRecording = useAppStore((state) => state.lastRecording);

  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const initializeFromDuration = useTimelineStore((s) => s.initializeFromDuration);
  const splitAt = useTimelineStore((s) => s.splitAt);

  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [cropToolActive, setCropToolActive] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<EditorTool | null>('background');
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [sourceResolution, setSourceResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Default the crop tool's selection to the first clip once segments exist,
  // and drop the selection if that clip gets deleted/reordered away. Adjusted
  // directly during render (rather than in an effect), guarded by the
  // `segments` array reference so it only reacts to genuine list changes.
  const [prevSegments, setPrevSegments] = useState(segments);
  if (segments !== prevSegments) {
    setPrevSegments(segments);
    if (segments.length === 0) {
      setSelectedSegmentId(null);
    } else if (!segments.some((s) => s.id === selectedSegmentId)) {
      setSelectedSegmentId(segments[0].id);
    }
  }

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) ?? null;

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
      .reduce((sum, s) => sum + (s.range.endMs - s.range.startMs), 0);
    const durationMs = selectedSegment.range.endMs - selectedSegment.range.startMs;
    splitAt(outputStart + durationMs / 2);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* <div className="flex shrink-0 items-center gap-4 border-b border-line p-6">
          <div>
            <h1 className="text-xl font-semibold">Edit Recording</h1>
            <p className="text-sm text-white/40">
              Screen Recording {new Date(lastRecording.createdAt).toISOString().slice(0, 10)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StatBadge label="Duration" value={formatDuration(keptDurationMs / 1000)} />
            <StatBadge
              label="Resolution"
              value={sourceResolution ? `${sourceResolution.height}p` : '--'}
            />
            <StatBadge label="Size" value={formatBytes(lastRecording.sizeBytes)} />
          </div>
        </div> */}

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
          timelineZoom={timelineZoom}
          onTimelineZoomChange={setTimelineZoom}
        />

        <CutTimeline
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={setSelectedSegmentId}
          zoom={timelineZoom}
        />
      </div>

      <EditorToolRail
        active={activeTool}
        onSelect={(tool) => setActiveTool((current) => (current === tool ? null : tool))}
      />
      {activeTool && <EditorToolPanel tool={activeTool} currentTimeMs={currentTimeMs} />}
    </div>
  );
}

import type { JSX } from 'react';
import { motion } from 'motion/react';
import {
  Clapperboard,
  Eye,
  EyeOff,
  Gauge,
  RotateCcw,
  Trash2,
  Video,
  VideoOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import {
  CLIP_SPEED_OPTIONS,
  AUDIO_VOLUME_OPTIONS,
  type TimelineSegment
} from '@screen-recorder/types/timeline';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { selectClipSegment } from '../../../store/selection-coordinator';
import { useTimelineStore } from '../store/timeline-store';
import { useWaveformStore } from '../store/waveform-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import {
  getSegmentOutputDurationMs,
  hasMergeableCutBoundary,
  gapBeforeSegmentMs
} from '../lib/segment-duration';
import { formatShortDuration } from '../lib/timeline-format';
import type { useEdgeResize } from '../lib/use-edge-resize';
import type { SegmentDragHandlers } from '../lib/use-segment-reorder-drag';
import { isLikelyLinux } from '../../../lib/platform';
import { CutMarker } from './CutMarker';
import { SegmentWaveform } from './SegmentWaveform';
import { cn } from '../../../lib/utils';

// Adjacent clip pills sit flush edge-to-edge (no visual gap) -- the only
// separation between them is the `ring` drawn on the selected/drag-over
// pill (a box-shadow, so it doesn't need layout space of its own). Kept as
// an explicit 0 (rather than dropping the left/width math below) so the
// percentages stay computed the same way regardless of clip count, in case
// a gap is ever reintroduced.
const CLIP_GAP_PX = 0;
// Below this, a head/tail trim or closed-up gap between clips is treated as
// float noise, not a real cut worth flagging with a badge.
const MIN_CUT_MARKER_GAP_MS = 100;

interface ClipPillProps {
  segment: TimelineSegment;
  index: number;
  /** Every kept segment, siblings included -- for the gap-before/merge checks below, which need to compare against neighbors. */
  segments: TimelineSegment[];
  leftPercent: number;
  widthPercent: number;
  dragOverIndex: number | null;
  dragHandlers: SegmentDragHandlers;
  isEdgeResizing: boolean;
  startResize: ReturnType<typeof useEdgeResize>['startResize'];
  /** Either the cut or zoom tool is armed -- suppresses this pill's normal select/drag/resize/double-click-to-split interactions in favor of `routeToolClick`. */
  isPointerToolActive: boolean;
  /** Cut/zoom tool's shared click handling (see use-timeline-click-router.ts) -- returns `true` if an armed tool handled the click, so this pill's own click falls back to selecting only when neither tool was armed. */
  routeToolClick: (clientX: number) => boolean;
}

/**
 * A single kept clip, absolutely positioned at its own output-timeline
 * left/width -- drag-to-reorder, drag-edges-to-trim, click-to-select (or
 * cut/zoom-place while a tool is armed), double-click-to-split, and its own
 * context menu (speed/volume/cursor/webcam/mute/reset-trim/delete).
 */
export function ClipPill({
  segment,
  index,
  segments,
  leftPercent,
  widthPercent,
  dragOverIndex,
  dragHandlers,
  isEdgeResizing,
  startResize,
  isPointerToolActive,
  routeToolClick
}: ClipPillProps): JSX.Element {
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId);
  const sourceDurationMs = useTimelineStore((s) => s.sourceDurationMs);
  const splitAt = useTimelineStore((s) => s.splitAt);
  const resizeSegmentEdge = useTimelineStore((s) => s.resizeSegmentEdge);
  const setSegmentSpeed = useTimelineStore((s) => s.setSegmentSpeed);
  const setSegmentAudioVolume = useTimelineStore((s) => s.setSegmentAudioVolume);
  const setSegmentCursorHidden = useTimelineStore((s) => s.setSegmentCursorHidden);
  const setSegmentWebcamHidden = useTimelineStore((s) => s.setSegmentWebcamHidden);
  const setSegmentAudioMuted = useTimelineStore((s) => s.setSegmentAudioMuted);
  const resetSegmentTrim = useTimelineStore((s) => s.resetSegmentTrim);
  const deleteSegment = useTimelineStore((s) => s.deleteSegment);
  // "Hide webcam" only makes sense to offer when this recording actually has
  // a webcam track and the PiP overlay is currently on -- same gate WebcamPip
  // itself uses to decide whether to render at all.
  const hasWebcamTrack = useScreenRecorderStore((s) => Boolean(s.lastRecording?.webcamPreviewUrl));
  const webcamEnabled = useWebcamStore((s) => s.enabled);
  const waveformPeaks = useWaveformStore((s) => s.peaks);
  // "Mute clip" only makes sense to offer when the recording actually has an
  // audio track to mute -- decodeWaveformPeaks (waveform-store.ts) fails and
  // leaves `peaks` null when there's none, so its presence doubles as that
  // check without a separate probe.
  const hasAudioTrack = waveformPeaks !== null;

  const isSelected = selectedSegmentId === segment.id;
  const gapBeforeMs = gapBeforeSegmentMs(segments, index);
  // Any boundary with a previous kept clip is a cut, whether or not it
  // later grew a visible ripple gap -- a plain split leaves `gapBeforeMs` at
  // 0, but the cut itself still happened and should keep marking the
  // timeline. Only the very first clip's own head trim needs the threshold
  // check, since an untrimmed recording start is never a cut.
  const hasCutBoundary = index > 0 || gapBeforeMs > MIN_CUT_MARKER_GAP_MS;

  function startResizeHandler(edge: 'start' | 'end', blockWidthPx: number) {
    const durationMs = segment.range.endMs - segment.range.startMs;
    const startValueMs = edge === 'start' ? segment.range.startMs : segment.range.endMs;
    return startResize(startValueMs, durationMs, blockWidthPx, (newMs) =>
      resizeSegmentEdge(segment.id, edge, newMs)
    );
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>): void {
    // A single click already performs the cut/zoom-place while a tool is
    // armed (see this pill's own onClick below) -- without this guard, a
    // real double-click would fire two clicks (two cuts/keyframes) *and*
    // this handler, attempting a third split against a since-stale index.
    if (isPointerToolActive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const outputStart = segments
      .slice(0, index)
      .reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
    const outputDurationMs = getSegmentOutputDurationMs(segment);
    splitAt(outputStart + fraction * outputDurationMs);
  }

  return (
    // The outer `motion.div` owns only position (`left`/`width`, animated
    // via `layout="position"` so a preceding clip's delete/trim ripples
    // this one to its new spot instead of teleporting) -- it can't also
    // carry the native HTML5 drag-to-reorder handlers below, since
    // `motion.div` shadows `onDragStart`/`onDrag`/`onDragEnd` for its own
    // (unused here) pan-gesture API, which conflicts with
    // `useSegmentReorderDrag`'s native drag events. So interaction stays on
    // the plain inner `div`, sized to fill it via `inset-0`. ContextMenu.Root
    // doesn't render a DOM node of its own, so it's a transparent wrapper
    // around the same element structure -- the inner element still owns
    // position/interaction only (no `overflow-hidden`), since a trim badge
    // is `absolute -top-*` from *this* box and must live outside the inner
    // pill's own `overflow-hidden`, or it'd clip its own badge.
    <motion.div
      layout="position"
      transition={
        isEdgeResizing ? { duration: 0 } : { type: 'tween', duration: 0.2, ease: 'easeOut' }
      }
      className="absolute inset-y-0 min-w-12"
      style={{
        left: `calc(${leftPercent}% + ${CLIP_GAP_PX / 2}px)`,
        width: `calc(${widthPercent}% - ${CLIP_GAP_PX}px)`
      }}
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger
          render={
            <div
              {...dragHandlers}
              draggable={!isPointerToolActive && dragHandlers.draggable}
              onClick={(e) => {
                // A tool armed: a click anywhere on a clip cuts/places a
                // keyframe at the exact cursor position (via the shared
                // whole-track-area calculation), rather than selecting --
                // which segment was clicked doesn't matter, `routeToolClick`
                // resolves position on its own.
                if (routeToolClick(e.clientX)) return;
                selectClipSegment(segment.id);
              }}
              onDoubleClick={handleDoubleClick}
              className={cn(
                'group absolute inset-0',
                isPointerToolActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
              )}
            >
              <div
                className={cn(
                  'relative flex h-full items-center justify-center overflow-hidden rounded-xl border border-orange-900/40',
                  dragOverIndex === index && 'ring-2 ring-accent',
                  dragOverIndex !== index && isSelected && 'ring-2 ring-accent'
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-blue-500 via-blue-400 to-blue-400" />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white/35 via-white/5 to-black/15" />

                {waveformPeaks && (
                  <SegmentWaveform
                    segment={segment}
                    peaks={waveformPeaks}
                    sourceDurationMs={sourceDurationMs}
                  />
                )}

                <div className="pointer-events-none relative flex flex-col items-center gap-0.5 px-2 text-orange-950/70">
                  <span className="flex items-center gap-1 truncate text-[10px] font-semibold">
                    <Clapperboard size={10} className="shrink-0" />
                    Clip
                  </span>
                  <span className="flex items-center gap-1 truncate text-[10px] text-orange-950/60">
                    {formatShortDuration(getSegmentOutputDurationMs(segment))}
                    <Gauge size={9} className="shrink-0" />
                    {segment.speed}x
                  </span>
                </div>

                <div
                  onPointerDown={(e) => {
                    // A tool armed: leave the pointerdown alone so it
                    // bubbles to the wrapper's onClick above and cuts/places
                    // there instead of starting a resize. A split clip's
                    // range is locked (see `TimelineSegment.split`), so the
                    // drag never starts there either.
                    if (isPointerToolActive || segment.split) return;
                    const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                    startResizeHandler('start', width)(e);
                  }}
                  title={segment.split ? 'Locked -- this edge is a cut' : undefined}
                  className={cn(
                    'absolute inset-y-0 left-0 w-1.5 bg-black/10',
                    segment.split ? 'cursor-default' : 'cursor-ew-resize hover:bg-black/25'
                  )}
                />
                <div
                  onPointerDown={(e) => {
                    if (isPointerToolActive || segment.split) return;
                    const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
                    startResizeHandler('end', width)(e);
                  }}
                  title={segment.split ? 'Locked -- this edge is a cut' : undefined}
                  className={cn(
                    'absolute inset-y-0 right-0 w-1.5 bg-black/10',
                    segment.split ? 'cursor-default' : 'cursor-ew-resize hover:bg-black/25'
                  )}
                />
              </div>

              {/*
                Cut marker for the boundary just before this clip -- shown
                for every split, not just once a trim opens a visible gap,
                so the marker stays put as soon as the cut is made rather
                than appearing only after the user later drags an edge.
                Duration prefers the actual trimmed-away footage when there
                is any (a deleted or ripple-trimmed stretch); a plain split
                has none of that yet, so it falls back to this clip's own
                output duration instead of showing nothing. Always centered
                exactly on the boundary it describes (via `CutMarker`'s
                anchor+translate pairing), including the first clip's own
                head cut.
              */}
              {hasCutBoundary && (
                <CutMarker
                  durationMs={
                    gapBeforeMs > MIN_CUT_MARKER_GAP_MS
                      ? gapBeforeMs
                      : getSegmentOutputDurationMs(segment)
                  }
                  anchorClassName="-translate-x-1/2"
                />
              )}
            </div>
          }
        />
        <ContextMenu.Content>
          <ContextMenu.SubmenuRoot>
            <ContextMenu.SubmenuTrigger>
              <Gauge size={13} className="shrink-0" />
              Set speed
            </ContextMenu.SubmenuTrigger>
            <ContextMenu.Content>
              <ContextMenu.RadioGroup
                value={segment.speed}
                onValueChange={(value) =>
                  setSegmentSpeed(segment.id, value as typeof segment.speed)
                }
              >
                {CLIP_SPEED_OPTIONS.map((speed) => (
                  <ContextMenu.RadioItem key={speed} value={speed}>
                    {speed}x
                  </ContextMenu.RadioItem>
                ))}
              </ContextMenu.RadioGroup>
            </ContextMenu.Content>
          </ContextMenu.SubmenuRoot>
          {hasAudioTrack && (
            <ContextMenu.SubmenuRoot>
              <ContextMenu.SubmenuTrigger>
                <Volume2 size={13} className="shrink-0" />
                Set volume
              </ContextMenu.SubmenuTrigger>
              <ContextMenu.Content>
                <ContextMenu.RadioGroup
                  value={segment.audioVolume}
                  onValueChange={(value) => setSegmentAudioVolume(segment.id, value as number)}
                >
                  {AUDIO_VOLUME_OPTIONS.map((volume) => (
                    <ContextMenu.RadioItem key={volume} value={volume}>
                      {Math.round(volume * 100)}%
                    </ContextMenu.RadioItem>
                  ))}
                </ContextMenu.RadioGroup>
              </ContextMenu.Content>
            </ContextMenu.SubmenuRoot>
          )}
          <ContextMenu.Separator />
          {!isLikelyLinux && (
            <ContextMenu.Item
              onClick={() => setSegmentCursorHidden(segment.id, !segment.cursorHidden)}
            >
              <span className="flex items-center gap-2">
                {segment.cursorHidden ? (
                  <EyeOff size={13} className="shrink-0" />
                ) : (
                  <Eye size={13} className="shrink-0" />
                )}
                {segment.cursorHidden ? 'Show mouse cursor' : 'Hide mouse cursor'}
              </span>
            </ContextMenu.Item>
          )}
          {hasWebcamTrack && webcamEnabled && (
            <ContextMenu.Item
              onClick={() => setSegmentWebcamHidden(segment.id, !segment.webcamHidden)}
            >
              <span className="flex items-center gap-2">
                {segment.webcamHidden ? (
                  <VideoOff size={13} className="shrink-0" />
                ) : (
                  <Video size={13} className="shrink-0" />
                )}
                {segment.webcamHidden ? 'Show webcam' : 'Hide webcam'}
              </span>
            </ContextMenu.Item>
          )}
          {hasAudioTrack && (
            <ContextMenu.Item onClick={() => setSegmentAudioMuted(segment.id, !segment.audioMuted)}>
              <span className="flex items-center gap-2">
                {segment.audioMuted ? (
                  <VolumeX size={13} className="shrink-0" />
                ) : (
                  <Volume2 size={13} className="shrink-0" />
                )}
                {segment.audioMuted ? 'Unmute clip' : 'Mute clip'}
              </span>
            </ContextMenu.Item>
          )}

          <ContextMenu.Separator />
          <ContextMenu.Item
            onClick={() => resetSegmentTrim(segment.id)}
            disabled={!segment.trimmed && !hasMergeableCutBoundary(segments, index)}
          >
            <span className="flex items-center gap-2">
              <RotateCcw size={13} className="shrink-0" />
              Reset trim
            </span>
          </ContextMenu.Item>
          <ContextMenu.Item
            onClick={() => deleteSegment(segment.id)}
            disabled={segments.length <= 1}
            className="text-danger data-[highlighted]:text-danger"
          >
            <span className="flex items-center gap-2">
              <Trash2 size={13} className="shrink-0" />
              Delete
            </span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    </motion.div>
  );
}

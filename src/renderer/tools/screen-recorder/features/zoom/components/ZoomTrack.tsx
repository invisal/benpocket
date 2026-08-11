import type { JSX } from 'react';
import { Mouse, MousePointerClick, Target, ZoomIn } from 'lucide-react';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import { DEFAULT_ZOOM_DEPTH, ZOOM_MIN_DURATION_MS } from '@shared/constants';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { useAppStore, EMPTY_CURSOR_PATH } from '../../../app/app-store';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { CLIP_ROW_HEIGHT_PX } from '../../timeline/lib/assign-lanes';
import { PillTrack } from '../../timeline/components/PillTrack';
import {
  getSegmentOutputDurationMs,
  sourceRangeToOutputPercent
} from '../../timeline/lib/segment-duration';
import { useZoomStore, findKeyframeContaining } from '../store/zoom-store';
import { resolveFixedPosition } from '../lib/resolve-fixed-position';

// Deliberately shorter than `DEFAULT_ZOOM_DURATION_MS` -- this only sizes
// the ghost preview pill's width, not the real keyframe `addKeyframe`
// creates on click (that still gets the normal default duration), so the
// preview reads as a compact "here's roughly where" marker rather than
// visually promising the full-length clip a click would actually commit.
const GHOST_PREVIEW_DURATION_MS = 1200;

interface ZoomTrackProps {
  /**
   * The zoom tool's live hover position, source-ms, or `null` when the tool
   * isn't armed or the cursor isn't over the timeline -- see
   * CutTimeline.tsx, which owns the hover tracking and passes this down.
   * While set, draws a translucent preview pill here at the depth/duration
   * a new keyframe would actually get from `useZoomStore.addKeyframe`, so
   * the user can see where a click would land before committing.
   */
  previewAtSourceMs?: number | null;
}

/**
 * Compact visual companion to `ZoomKeyframeEditor` (the real editing
 * surface, in the right-hand tool panel) -- see PillTrack.tsx for the
 * shared drag/resize/lane-out mechanics. Clicking a pill seeks there and
 * brings the Zoom panel into focus on that keyframe's own card, rather than
 * this compact overview trying to be the real editor (see
 * ZoomKeyframeEditor's scroll-to effect keyed on `selectedKeyframeId`).
 */
export function ZoomTrack({ previewAtSourceMs = null }: ZoomTrackProps): JSX.Element | null {
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const sourceDurationMs = useTimelineStore((s) => s.sourceDurationMs);
  const requestSeek = useTimelineStore((s) => s.requestSeek);
  const setActiveTool = useTimelineStore((s) => s.setActiveTool);
  const keyframes = useZoomStore((s) => s.keyframes);
  const updateKeyframe = useZoomStore((s) => s.updateKeyframe);
  const duplicateKeyframe = useZoomStore((s) => s.duplicateKeyframe);
  const removeKeyframe = useZoomStore((s) => s.removeKeyframe);
  const selectedKeyframeId = useZoomStore((s) => s.selectedKeyframeId);
  const setSelectedKeyframeId = useZoomStore((s) => s.setSelectedKeyframeId);
  const clickPath = useAppStore((s) => s.lastRecording?.clickPath ?? EMPTY_CURSOR_PATH);
  const cursorPath = useAppStore((s) => s.lastRecording?.cursorPath ?? EMPTY_CURSOR_PATH);

  // Disabling "follow cursor" needs *some* fixed point to land on -- see
  // `resolveFixedPosition`'s own doc for the fallback chain.
  function toggleFollowCursor(kf: ZoomKeyframe): void {
    if (kf.position !== 'auto-cursor') {
      updateKeyframe(kf.id, { position: 'auto-cursor' });
      return;
    }
    updateKeyframe(kf.id, {
      position: resolveFixedPosition(clickPath, cursorPath, kf.atMs, kf.durationMs)
    });
  }

  // No ghost over a stretch that already has a keyframe -- a click there
  // wouldn't add one *here* anyway (it'd snap in right after the existing
  // one, see clampToNonOverlapping in zoom-store.ts), so showing the
  // preview at the cursor's exact position would be misleading.
  const previewOnExistingKeyframe =
    previewAtSourceMs !== null
      ? findKeyframeContaining(keyframes, previewAtSourceMs) !== null
      : false;
  const ghostPercent =
    previewAtSourceMs !== null && !previewOnExistingKeyframe
      ? sourceRangeToOutputPercent(
          segments,
          segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0),
          previewAtSourceMs,
          previewAtSourceMs + GHOST_PREVIEW_DURATION_MS
        )
      : null;

  // Unlike Caption/Annotation/Blur-Mask (added from their own tool panels),
  // a zoom keyframe is placed by clicking/dragging directly on this track --
  // so, unique to Zoom, the row stays reserved and shows a discoverability
  // hint even with zero keyframes, rather than collapsing to nothing the
  // way PillTrack itself does (see PillTrack.tsx) when there's nothing to
  // draw. Suppressed while the ghost preview is showing (tool armed and
  // hovering) since that already previews exactly where a click would land.
  const showEmptyHint = keyframes.length === 0 && !ghostPercent;

  return (
    <div
      className="relative"
      // Matches PillTrack's own single-lane sizing (`py-1` top+bottom plus
      // one `laneHeightPx` row) so the empty hint / ghost preview reserve
      // exactly as much height as a real pill would, and whatever track
      // sits below never jumps when one appears/disappears.
      style={{ minHeight: CLIP_ROW_HEIGHT_PX + 8 }}
    >
      {showEmptyHint && (
        <div className="flex items-center px-1 py-1" style={{ height: CLIP_ROW_HEIGHT_PX + 8 }}>
          <div className="flex h-full w-full items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <MousePointerClick size={12} className="shrink-0" />
            Click or drag to add zoom on cursor
          </div>
        </div>
      )}

      {keyframes.length > 0 && (
        <PillTrack
          items={keyframes}
          segments={segments}
          getStartMs={(kf) => kf.atMs}
          getDurationMs={(kf) => kf.durationMs}
          isSelected={(kf) => selectedKeyframeId === kf.id}
          getTitle={(kf) =>
            `${kf.depth.toFixed(1)}x at ${(kf.atMs / 1000).toFixed(1)}s -- ${
              kf.position === 'auto-cursor' ? 'follows cursor' : 'fixed point'
            } -- drag to move, edges to trim`
          }
          // Dark-border + text treatment as CutTimeline's clip segments (see
          // CutTimeline.tsx) -- the fill/highlight gradients themselves are two
          // stacked layers in renderContent below, not a background class here,
          // for exact parity with how the clip bar layers its own. Scoped to
          // ZoomTrack alone (colorClassName is applied as-is by PillTrack, so
          // CaptionTrack/AnnotationTrack/BlurMaskTrack, which share PillTrack,
          // are unaffected).
          colorClassName="border-purple-900/40 text-purple-950"
          handleClassName="bg-black/10 hover:bg-black/25"
          // Taller than the default single-line pill (see PillTrack.tsx's
          // `laneHeightPx`) so a "Zoom" title row can sit above the icon row,
          // matching the reference's two-line badge -- scoped to this track
          // alone, doesn't affect Caption/Annotation/BlurMask's lane math. Uses
          // the clip row's own height so the two stay visually consistent
          // instead of coincidentally matching magic numbers.
          laneHeightPx={CLIP_ROW_HEIGHT_PX}
          renderContent={(kf) => (
            <>
              {/* Same two-layer gradient as the clip bar's background
              (CutTimeline.tsx): a base color fill, then a light-at-bottom
              -fading-to-dark-at-top highlight on top, just purple instead
              of amber. Needs the sibling `relative` wrapper below so its
              (in-flow, non-positioned) content still paints above these
              (positioned) layers -- see CutTimeline.tsx's segments/
              background layers for the same ordering concern. */}
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-purple-400 via-purple-500 to-purple-600" />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white/40 via-white/5 to-black/15" />
              <div className="relative flex flex-col items-center justify-center gap-0.5 leading-none">
                <span className="text-[9px] font-semibold text-purple-950">Zoom</span>
                <span className="flex items-center gap-2 text-[10px] font-semibold">
                  <span className="flex items-center gap-1">
                    <ZoomIn size={11} className="shrink-0" />
                    {kf.depth.toFixed(1)}×
                  </span>
                  <span className="flex items-center gap-1">
                    {kf.position === 'auto-cursor' ? <Mouse size={11} /> : <Target size={10} />}
                    {kf.position === 'auto-cursor' ? 'Auto' : 'Manual'}
                  </span>
                </span>
              </div>
            </>
          )}
          onSelect={(kf) => {
            requestSeek(kf.atMs);
            setActiveTool('zoom');
            setSelectedKeyframeId(kf.id);
          }}
          onMove={(kf, atMs) => updateKeyframe(kf.id, { atMs }, sourceDurationMs)}
          onResizeStart={(kf, newAtMs) => {
            const endMs = kf.atMs + kf.durationMs;
            const clampedAtMs = Math.min(newAtMs, endMs - ZOOM_MIN_DURATION_MS);
            updateKeyframe(
              kf.id,
              {
                atMs: clampedAtMs,
                durationMs: Math.max(endMs - clampedAtMs, ZOOM_MIN_DURATION_MS)
              },
              sourceDurationMs
            );
          }}
          onResizeEnd={(kf, newEndMs) => {
            updateKeyframe(
              kf.id,
              { durationMs: Math.max(newEndMs - kf.atMs, ZOOM_MIN_DURATION_MS) },
              sourceDurationMs
            );
          }}
          onDelete={(kf) => removeKeyframe(kf.id)}
          isDisabled={(kf) => !kf.enabled}
          onToggleDisabled={(kf) => updateKeyframe(kf.id, { enabled: !kf.enabled })}
          onDuplicate={(kf) => {
            const newId = duplicateKeyframe(kf.id, sourceDurationMs);
            if (!newId) return;
            requestSeek(kf.atMs + kf.durationMs);
            setActiveTool('zoom');
            setSelectedKeyframeId(newId);
          }}
          renderExtraMenuItems={(kf) => (
            <ContextMenu.Item onClick={() => toggleFollowCursor(kf)}>
              <span className="flex items-center gap-2">
                {kf.position === 'auto-cursor' ? (
                  <Target size={14} className="text-text-dim" />
                ) : (
                  <Mouse size={14} className="text-text-dim" />
                )}
                {kf.position === 'auto-cursor' ? 'Manual' : 'Follow Cursor'}
              </span>
            </ContextMenu.Item>
          )}
        />
      )}

      {ghostPercent && (
        // Reproduces PillTrack's own outer wrapper exactly (`flex
        // items-center py-1 px-1`, then an inner `relative` box) so this
        // percent-positioned ghost lines up pixel-for-pixel with real
        // pills, without needing to touch PillTrack itself (shared by
        // Caption/Annotation/BlurMask tracks too). `pointer-events-none`
        // throughout -- it's a preview, not interactive; CutTimeline's
        // ruler/clip-row clicks are what actually place the keyframe.
        <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center py-1 px-1">
          <div className="relative w-full" style={{ height: CLIP_ROW_HEIGHT_PX }}>
            <div
              className="absolute overflow-hidden rounded-md border border-purple-900/40 opacity-50"
              style={{
                left: `${ghostPercent.leftPercent}%`,
                width: 80,
                height: CLIP_ROW_HEIGHT_PX
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-purple-400 via-purple-500 to-purple-600" />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-white/40 via-white/5 to-black/15" />
              <div className="relative flex h-full flex-col items-center justify-center gap-0.5 leading-none">
                <span className="text-[9px] font-semibold text-purple-950">Zoom</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-950">
                  <ZoomIn size={11} className="shrink-0" />
                  {DEFAULT_ZOOM_DEPTH.toFixed(1)}×
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

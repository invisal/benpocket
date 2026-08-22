import { useTimelineStore } from '../features/timeline/store/timeline-store';
import { useZoomStore } from '../features/zoom/store/zoom-store';
import { useAnnotationsStore } from '../features/annotations/store/annotations-store';
import { useBlurMaskStore } from '../features/blur-mask/store/blur-mask-store';

/**
 * Single write path for "select a clip / zoom keyframe / annotation /
 * blur-mask region" -- each of those four lives in its own store with its
 * own independent `selectedXId` field, so selecting one used to leave
 * whatever was already selected in the other three untouched. That made it
 * ambiguous which one a Delete/Cmd+X keypress should act on whenever more
 * than one happened to be selected at once (see
 * use-editor-keyboard-shortcuts.ts). Every click/duplicate/drag-start
 * handler that selects one of these four should call the matching function
 * here instead of that store's own `setSelectedXId` action directly, so
 * only the most-recently-selected one is ever active.
 *
 * Deliberately its own module rather than living on one of the four stores
 * -- `timeline-store.ts` already imports `zoom-store.ts` (for reconciling
 * keyframes against cut segments), so having any of the four import a
 * coordinator that itself imports back into `timeline-store.ts` would
 * create a cycle. This module depends on all four; none of them import it
 * back.
 */

export function selectClipSegment(id: string): void {
  useZoomStore.getState().setSelectedKeyframeId(null);
  useAnnotationsStore.getState().setSelectedAnnotationId(null);
  useBlurMaskStore.getState().setSelectedRegionId(null);
  useTimelineStore.getState().setSelectedSegmentId(id);
}

export function selectZoomKeyframe(id: string): void {
  useTimelineStore.getState().setSelectedSegmentId(null);
  useAnnotationsStore.getState().setSelectedAnnotationId(null);
  useBlurMaskStore.getState().setSelectedRegionId(null);
  useZoomStore.getState().setSelectedKeyframeId(id);
}

export function selectAnnotation(id: string): void {
  useTimelineStore.getState().setSelectedSegmentId(null);
  useZoomStore.getState().setSelectedKeyframeId(null);
  useBlurMaskStore.getState().setSelectedRegionId(null);
  useAnnotationsStore.getState().setSelectedAnnotationId(id);
}

export function selectBlurMaskRegion(id: string): void {
  useTimelineStore.getState().setSelectedSegmentId(null);
  useZoomStore.getState().setSelectedKeyframeId(null);
  useAnnotationsStore.getState().setSelectedAnnotationId(null);
  useBlurMaskStore.getState().setSelectedRegionId(id);
}

/** Deselects whichever of the four is currently active -- e.g. Escape. */
export function clearSelection(): void {
  useTimelineStore.getState().setSelectedSegmentId(null);
  useZoomStore.getState().setSelectedKeyframeId(null);
  useAnnotationsStore.getState().setSelectedAnnotationId(null);
  useBlurMaskStore.getState().setSelectedRegionId(null);
}

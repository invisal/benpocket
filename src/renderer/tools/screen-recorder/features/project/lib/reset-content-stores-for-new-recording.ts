import { useBackgroundStore } from '../../background/store/background-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { useCaptionsStore } from '../../captions/store/captions-store';
import { useAnnotationsStore } from '../../annotations/store/annotations-store';
import { useBlurMaskStore } from '../../blur-mask/store/blur-mask-store';
import { useCropStore } from '../../crop/store/crop-store';
import { useZoomStore } from '../../zoom/store/zoom-store';

/**
 * Resets every per-project content store back to its pristine defaults for a
 * brand-new recording, which starts with none of this -- unlike opening a
 * saved project, where `applyProjectSnapshot` overwrites each store with
 * that project's own saved values, nothing else does this for a fresh
 * recording. Without it, whatever a previous session's editing left in
 * these stores (a blur region positioned for the old video's layout, a
 * background/crop/caption setup, ...) silently carries over into the new
 * one instead of starting blank.
 *
 * `getInitialState()` returns each store's pristine just-created state
 * (zustand v5, unaffected by any later `set` calls) -- resetting to that
 * rather than hand-maintained default literals here means there's nothing
 * to keep in sync if a store's own defaults ever change.
 *
 * `useWebcamStore` is deliberately excluded -- it's wrapped in `persist`
 * (see webcam-store.ts) specifically so shape/mirrored survive across
 * recordings as a sticky preference, not a per-project setting to reset;
 * `getInitialState()` there would mean the hardcoded literal, discarding
 * that persisted preference.
 *
 * Only resets zoom's `mode`/`selectedKeyframeId` (not `keyframes`) --
 * `useRecordingController`'s `finalize()` already re-seeds `keyframes`
 * itself from this recording's actual clicks, using the *pre-reset* `mode`
 * to decide whether to auto-generate; call this only after that's run.
 */
export function resetContentStoresForNewRecording(): void {
  useBackgroundStore.setState(useBackgroundStore.getInitialState(), true);
  useCursorStore.setState(useCursorStore.getInitialState(), true);
  useCaptionsStore.setState(useCaptionsStore.getInitialState(), true);
  useAnnotationsStore.setState(useAnnotationsStore.getInitialState(), true);
  useBlurMaskStore.setState(useBlurMaskStore.getInitialState(), true);
  useCropStore.setState(useCropStore.getInitialState(), true);
  useZoomStore.setState({ mode: 'auto', selectedKeyframeId: null });
}

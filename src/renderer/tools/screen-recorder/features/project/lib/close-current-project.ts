import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { useTimelineStore } from '../../timeline/store/timeline-store';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { resetHistory } from '../../history/store/history-store';
import { resetContentStoresForNewRecording } from './reset-content-stores-for-new-recording';

/**
 * Fully closes out whatever project/recording is currently open in the
 * editor -- for when that project gets deleted out from under it (see
 * LibraryPage.tsx/ScreenRecorderSidebar.tsx's own delete handlers, which
 * call this only when the deleted id matches `currentProjectId`), so the
 * editor doesn't keep showing a video -- and all its edited state -- whose
 * file was just unlinked from disk.
 *
 * Reuses `resetContentStoresForNewRecording` for the content stores it
 * already resets to pristine defaults, then covers what that function
 * deliberately leaves for a caller to handle itself: zoom `keyframes` (that
 * function only resets `mode`/`selectedKeyframeId`, relying on a fresh
 * recording's own finalize() to reseed `keyframes` from real click data --
 * there's no such data here, so this clears them directly) and the timeline
 * store's own `tracks`/`sourceDurationMs` (which that function doesn't
 * touch at all).
 */
export function closeCurrentProject(): void {
  resetContentStoresForNewRecording();
  useZoomStore.setState({ keyframes: [] });
  useTimelineStore.setState(useTimelineStore.getInitialState(), true);
  resetHistory();
  useScreenRecorderStore.setState({
    lastRecording: null,
    sourceResolution: null,
    currentProjectId: null,
    projectName: useScreenRecorderStore.getInitialState().projectName
  });
}

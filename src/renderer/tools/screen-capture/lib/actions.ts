import { toolTabsStore } from '@renderer/components/providers/ToolProvider';
import { selectAndCaptureRegion } from './capture-frame';
import { useCaptureResultStore } from '../store/capture-result.store';

// Action helpers shared between TrayBridge (tray menu clicks) and this tool's
// keybindings.ts (global-shortcut fires) -- add more here as either gains
// another shared entry point, rather than one file per function.

/**
 * Focuses (or opens) the Screen Capture tab. Returns whether the tab
 * actually ended up focused/open -- both `selectTab` and `openTab` can be
 * blocked by the tab's own leave guard (e.g. unsaved editor changes on
 * whatever tab was active before this), in which case callers with a
 * follow-up action must skip it rather than running as if the tab had
 * switched when it didn't.
 */
export function focusOrOpenScreenCapture(): boolean {
  const { tabs, selectTab, openTab } = toolTabsStore.getState();
  const existing = tabs.find((t) => t.type === 'screen-capture');
  if (existing) return selectTab(existing.id);
  return openTab('screen-capture', {}) !== null;
}

/**
 * Captures with no BenPocket UI in between (no pill, no idle screen), then
 * hands the result to useCaptureResultStore -- the same handoff
 * CaptureToolbarBridge uses -- so a mounted (or freshly opened) Screen Capture
 * tab picks it up via its `pendingCapture` effect and shows the result editor.
 *
 * Only opens/focuses the tab once there's actually an image: a cancelled
 * picker should leave the user wherever they were, which matters most for the
 * tray entry point where the window may never have been on screen.
 */
export async function captureRegionDirectly(): Promise<void> {
  const usesOsPicker = window.api?.usesOsCapturePicker ?? false;
  try {
    // Wayland's portal branch ignores `sources`, and the listing is slow enough
    // to be a visible lag before the OS picker appears -- skip it there, same as
    // index.tsx's runRegionCapture.
    const sources = usesOsPicker ? [] : await window.screenRecorder.recording.getCaptureSources();
    const blob = await selectAndCaptureRegion(sources, usesOsPicker);
    if (!blob) return;
    useCaptureResultStore.getState().setPending(blob);
    focusOrOpenScreenCapture();
  } catch (err) {
    console.error('Could not capture region.', err);
    focusOrOpenScreenCapture();
  }
}

import type { KeybindingAction } from '@renderer/types/keybindings';
import { focusOrOpenScreenCapture } from './lib/actions';
import { selectAndCaptureRegion } from './lib/capture-frame';
import { openCaptureToolbarFor } from './lib/open-capture-toolbar';
import { useCaptureResultStore } from './store/capture-result.store';

/**
 * Drags a region directly (no capture-toolbar pill in between), then hands
 * the result to useCaptureResultStore -- the same handoff CaptureToolbarBridge
 * uses -- so a mounted (or freshly opened) Screen Capture tab picks it up via
 * its `pendingCapture` effect and shows the result editor.
 */
async function captureRegionDirectly(): Promise<void> {
  const usesOsPicker = window.api?.usesOsCapturePicker ?? false;
  try {
    // No thumbnail rendered here -- skip the expensive per-source encode.
    const sources = await window.screenRecorder.recording.getCaptureSources({
      includeThumbnails: false
    });
    const blob = await selectAndCaptureRegion(sources, usesOsPicker);
    if (blob) useCaptureResultStore.getState().setPending(blob);
  } catch (err) {
    console.error('Could not capture region.', err);
  } finally {
    focusOrOpenScreenCapture();
  }
}

export const screenCaptureKeybindingActions: KeybindingAction[] = [
  {
    id: 'screen-capture:capture-region',
    group: 'Screen Capture',
    actionName: 'Capture region',
    description: 'Drag to select a region on screen and capture it immediately.',
    action: () => {
      void captureRegionDirectly();
    }
  },
  {
    id: 'screen-capture:open-toolbar',
    group: 'Screen Capture',
    actionName: 'Open Toolbar',
    description: 'Open the floating capture toolbar to pick screen, window, or area.',
    action: () => {
      // The toolbar pill isn't used on Wayland (portal handles picking) --
      // focus/open the tab instead, same fallback TrayBridge's "Screen
      // Capture" tray item uses.
      if (window.api?.usesOsCapturePicker) {
        focusOrOpenScreenCapture();
        return;
      }
      void openCaptureToolbarFor();
    }
  }
];

import { CameraIcon, Crop } from 'lucide-react';
import type { KeybindingAction } from '@renderer/types/keybindings';
import { captureRegionDirectly, focusOrOpenScreenCapture } from './lib/actions';
import { openCaptureToolbarFor } from './lib/open-capture-toolbar';

export const screenCaptureKeybindingActions: KeybindingAction[] = [
  {
    id: 'screen-capture:capture-region',
    group: 'Screen Capture',
    actionName: 'Capture region',
    description: 'Drag to select a region on screen and capture it immediately.',
    icon: Crop,
    action: () => {
      void captureRegionDirectly();
    }
  },
  {
    id: 'screen-capture:open-toolbar',
    group: 'Screen Capture',
    actionName: 'Open Toolbar',
    description: 'Open the floating capture toolbar to pick screen, window, or area.',
    icon: CameraIcon,
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

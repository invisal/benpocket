import { VideoIcon } from 'lucide-react';
import type { KeybindingAction } from '@renderer/types/keybindings';
import { focusRecorderTab } from './lib/actions';
import { openRecorderToolbarFor } from './features/recording/lib/open-recorder-toolbar';

export const screenRecorderKeybindingActions: KeybindingAction[] = [
  {
    id: 'screen-recorder:open-toolbar',
    group: 'Screen Recorder',
    actionName: 'Open Toolbar',
    description: 'Focus Screen Recorder and open the floating recording toolbar.',
    icon: VideoIcon,
    action: () => {
      if (!focusRecorderTab()) return;
      // No source passed -- opens immediately instead of waiting on a full
      // capture-sources fetch; see openRecorderToolbarFor's own doc.
      void openRecorderToolbarFor();
    }
  }
];

export interface ShortcutBinding {
  id: string;
  action: string;
  accelerator: string;
}

export const DefaultShortcuts: ShortcutBinding[] = [
  {
    id: 'start-stop-recording',
    action: 'Start/Stop Recording',
    accelerator: 'CommandOrControl+Shift+R'
  },
  {
    id: 'pause-resume-recording',
    action: 'Pause/Resume Recording',
    accelerator: 'CommandOrControl+Shift+P'
  },
  { id: 'toggle-webcam', action: 'Toggle Webcam', accelerator: 'CommandOrControl+Shift+W' }
];

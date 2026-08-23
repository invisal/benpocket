export type Mode =
  'setup' | 'counting' | 'starting' | 'recording' | 'paused' | 'restarting' | 'stopping';

// Carries its own settings-action so any permission failure can drive the same banner.
export type ToolbarError = { message: string; openSettings?: () => void; settingsLabel?: string };

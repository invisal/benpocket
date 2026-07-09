import { create } from 'zustand';
import type { CursorPathPoint } from '@screen-recorder/types/project';

export type ScreenRecorderRoute =
  'record-setup' | 'recording-hud' | 'editor' | 'library' | 'presets' | 'settings';

interface LastRecording {
  previewUrl: string;
  filePath: string | null;
  sizeBytes: number;
  createdAt: number;
  /** Recorded system-cursor samples, source-timeline `atMs`. Empty for window captures. */
  cursorPath: CursorPathPoint[];
}

interface AppStoreState {
  route: ScreenRecorderRoute;
  setRoute: (route: ScreenRecorderRoute) => void;
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
  lastRecording: LastRecording | null;
  setLastRecording: (recording: LastRecording) => void;
  projectName: string;
}

export const useAppStore = create<AppStoreState>((set) => ({
  route: 'record-setup',
  setRoute: (route) => set({ route }),
  isRecording: false,
  setIsRecording: (isRecording) => set({ isRecording }),
  lastRecording: null,
  setLastRecording: (lastRecording) => set({ lastRecording }),
  projectName: 'Untitled Recording'
}));

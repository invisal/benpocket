import { create } from 'zustand';

export type ScreenStudioRoute =
  'record-setup' | 'recording-hud' | 'editor' | 'library' | 'presets' | 'settings';

interface LastRecording {
  previewUrl: string;
  filePath: string | null;
  sizeBytes: number;
  createdAt: number;
}

interface AppStoreState {
  route: ScreenStudioRoute;
  setRoute: (route: ScreenStudioRoute) => void;
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

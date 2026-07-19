import { create } from 'zustand';
import type { CursorPathPoint } from '@screen-recorder/types/project';

export type ScreenRecorderRoute = 'editor' | 'library' | 'presets' | 'settings';

interface LastRecording {
  previewUrl: string;
  filePath: string | null;
  sizeBytes: number;
  createdAt: number;
  /** Recorded system-cursor samples, source-timeline `atMs`. Empty for window captures. */
  cursorPath: CursorPathPoint[];
  /** Recorded real mousedown events (see click-tracker.ts), same convention as cursorPath. */
  clickPath: CursorPathPoint[];
}

interface AppStoreState {
  route: ScreenRecorderRoute;
  setRoute: (route: ScreenRecorderRoute) => void;
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
  lastRecording: LastRecording | null;
  setLastRecording: (recording: LastRecording) => void;
  /** Library's "Remove" action -- just the in-memory/route-level state; the caller is responsible for deleting the underlying file and revoking `previewUrl` first (see LibraryPage.tsx). */
  clearLastRecording: () => void;
  projectName: string;
}

export const useAppStore = create<AppStoreState>((set) => ({
  route: 'library',
  setRoute: (route) => set({ route }),
  isRecording: false,
  setIsRecording: (isRecording) => set({ isRecording }),
  lastRecording: null,
  setLastRecording: (lastRecording) => set({ lastRecording }),
  clearLastRecording: () => set({ lastRecording: null }),
  projectName: 'Untitled Recording'
}));

import { create } from 'zustand';

interface AppRoute {}
export interface LastRecording {
  /** In-memory object URL for immediate preview (revoked when replaced). */
  previewUrl: string;
  /** Absolute path on disk, once features/recording has saved it. */
  filePath: string | null;
  sizeBytes: number;
  createdAt: number;
}

interface AppStoreState {
  route: AppRoute;
  projectName: string;
  lastRecording: LastRecording | null;
  isRecording: boolean;
  setRoute: (route: AppRoute) => void;
  setProjectName: (name: string) => void;
  setIsRecording: (isRecording: boolean) => void;
  setLastRecording: (recording: LastRecording | null) => void;
}

export const useScreenStudioStore = create<AppStoreState>((set, get) => ({
  route: 'record',
  projectName: 'Untitled Recording',
  lastRecording: null,
  isRecording: false,
  setRoute: (route) => set({ route }),
  setProjectName: (projectName) => set({ projectName }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setLastRecording: (recording) => {
    const previous = get().lastRecording;
    if (previous && previous.previewUrl !== recording?.previewUrl) {
      URL.revokeObjectURL(previous.previewUrl);
    }
    set({ lastRecording: recording });
  }
}));

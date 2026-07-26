import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentRecording {
  id: string;
  name: string;
  filePath: string | null;
  webcamFilePath: string | null;
  sizeBytes: number;
  createdAt: number;
}

const MAX_RECENT_RECORDINGS = 5;

interface RecentRecordingsStoreState {
  recordings: RecentRecording[];
  addRecording: (recording: RecentRecording) => void;
  removeRecording: (id: string) => void;
}

/**
 * Sidebar's "Recent" shortcut list -- metadata only (no blob URL, no
 * cursor/click path), so it's cheap to persist and survives app restarts.
 * Separate from `lastRecording` in app-store.ts, which holds the live,
 * in-session data the editor actually plays back; entries here that aren't
 * the current `lastRecording` are opened via the OS's default player
 * instead (see ScreenRecorderSidebar.tsx).
 */
export const useRecentRecordingsStore = create<RecentRecordingsStoreState>()(
  persist(
    (set) => ({
      recordings: [],
      addRecording: (recording) =>
        set((state) => ({
          recordings: [recording, ...state.recordings].slice(0, MAX_RECENT_RECORDINGS)
        })),
      removeRecording: (id) =>
        set((state) => ({ recordings: state.recordings.filter((r) => r.id !== id) }))
    }),
    { name: 'craftbox-screen-recorder-recent-recordings' }
  )
);

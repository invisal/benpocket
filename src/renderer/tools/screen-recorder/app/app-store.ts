import { create } from 'zustand';
import type { CursorPathPoint } from '@screen-recorder/types/project';
import type { SourceResolution } from '@screen-recorder/types/editor';

export type ScreenRecorderRoute = 'editor' | 'library' | 'settings';

/**
 * Shared, referentially-stable fallback for `lastRecording?.cursorPath ?? []`
 * / `?? []`-style selectors reading off `lastRecording` (now that it can
 * genuinely be `null` while its consumers are mounted -- see EditorPage.tsx
 * rendering PreviewStage before a project finishes loading). A literal `[]`
 * inline in a zustand selector is a *new* array every call, which
 * `useSyncExternalStore` (what zustand's hooks are built on) never sees as
 * equal to the previous snapshot -- React re-renders, re-runs the selector,
 * gets another new `[]`, and loops forever ("Maximum update depth
 * exceeded"). Using this same reference every time gives it something
 * stable to compare against instead.
 */
export const EMPTY_CURSOR_PATH: CursorPathPoint[] = [];

interface LastRecording {
  previewUrl: string;
  filePath: string | null;
  /**
   * What export should actually read instead of `filePath`, when it
   * differs -- see capture-engine.ts's `StopResult.video.exportSourceBlob`
   * doc. Undefined for anything that didn't go through
   * useRecordingController.ts's own `finalize()` (an imported video, a
   * reopened saved project) -- callers fall back to `filePath` in that
   * case, same as before this field existed.
   */
  exportSourceFilePath?: string | null;
  sizeBytes: number;
  createdAt: number;
  /** Recorded system-cursor samples, source-timeline `atMs`. Empty for window captures. */
  cursorPath: CursorPathPoint[];
  /** Recorded real mousedown events (see click-tracker.ts), same convention as cursorPath. */
  clickPath: CursorPathPoint[];
  /** Blob URL for the parallel webcam recording, if the webcam was enabled. Null otherwise, or if saving it failed. */
  webcamPreviewUrl: string | null;
  /** Absolute path to the saved webcam file, for export -- see capture-engine.ts's `CaptureRequest.webcam`. */
  webcamFilePath: string | null;
  /** What export should read instead of `webcamFilePath`, when it differs -- see `exportSourceFilePath`'s doc, same reasoning for the webcam file. */
  webcamExportSourceFilePath?: string | null;
  /** `webcamStartedAt - startedAt` from capture-engine.ts's `StopResult` -- the webcam recorder's `MediaRecorder` starts a moment after the main one, so this is added to a main-timeline `atMs` to find the corresponding moment in the webcam file. */
  webcamOffsetMs: number;
  /** Which flow produced this session -- carried into `Project.source` on save, see project.ts. */
  source: 'recorded' | 'imported';
}

interface AppStoreState {
  route: ScreenRecorderRoute;
  setRoute: (route: ScreenRecorderRoute) => void;
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
  /**
   * Whether the floating recorder-toolbar (see recorder-toolbar-window.ts) is
   * currently open, from setup through an active recording until it's
   * cancelled or stopped. Drives disabling "Launch Recorder" in
   * ScreenRecorderSidebar.tsx -- re-invoking it while the toolbar was already
   * open used to reload the toolbar's window out from under an active
   * recording, leaving no way to reach its Stop button.
   */
  isRecorderToolbarOpen: boolean;
  setRecorderToolbarOpen: (isRecorderToolbarOpen: boolean) => void;
  lastRecording: LastRecording | null;
  setLastRecording: (recording: LastRecording) => void;
  /** Library's "Remove" action -- just the in-memory/route-level state; the caller is responsible for deleting the underlying file and revoking `previewUrl` first (see LibraryPage.tsx). */
  clearLastRecording: () => void;
  /**
   * Mirrors EditorPage's own local `sourceResolution` state (set from the
   * `<video>` element's `videoWidth`/`videoHeight` once metadata loads) --
   * duplicated here so `useExportAction.ts`, which lives outside EditorPage
   * entirely (ExportDialogButton is a nav-bar sibling in
   * ScreenRecorderApp.tsx), can know the recording's native aspect ratio
   * too, for exporting at that aspect when the background is disabled.
   */
  sourceResolution: SourceResolution | null;
  setSourceResolution: (sourceResolution: SourceResolution | null) => void;
  /**
   * Set by `useOpenProject` for the duration of a `project:open` +
   * `applyProjectSnapshot` call -- shared here (not just that hook's own
   * local state) so EditorPage can show `EditorLoading` for the sidebar's
   * launch-time auto-resume of the most recent project, instead of the
   * route only flipping to 'editor' once loading has *already* finished
   * with nothing visible happening beforehand.
   */
  isOpeningProject: boolean;
  setIsOpeningProject: (isOpeningProject: boolean) => void;
  projectName: string;
  setProjectName: (projectName: string) => void;
  /** Set once a project's first successful save assigns it an id -- reused on subsequent saves so "Save project" overwrites the same file instead of piling up duplicates. */
  currentProjectId: string | null;
  setCurrentProjectId: (currentProjectId: string) => void;
  /** Bumped on every successful `project:save` so long-lived components (the sidebar's recent-projects list, which doesn't remount on route change like LibraryPage does) know to re-fetch `project:list`. */
  projectsVersion: number;
  bumpProjectsVersion: () => void;
  /** Left "Assets" sidebar's own drag-resized width, px -- see ResizablePanel in ScreenRecorderApp.tsx. */
  sidebarWidth: number;
  setSidebarWidth: (sidebarWidth: number) => void;
  /** EditorToolPanel's own drag-resized width, px -- see ResizablePanel in EditorPage.tsx. */
  toolPanelWidth: number;
  setToolPanelWidth: (toolPanelWidth: number) => void;
  /** CutTimeline's own drag-resized height, px -- see ResizablePanel in CutTimeline.tsx. */
  timelinePanelHeight: number;
  setTimelinePanelHeight: (timelinePanelHeight: number) => void;
  /**
   * Bumped by the Cmd/Ctrl+S shortcut (see use-editor-keyboard-shortcuts.ts)
   * to ask ScreenRecorderApp to run its own `handleSaveClick` -- a one-shot
   * "request" (like timeline-store's `seekRequestMs`) rather than the
   * shortcut calling a save function directly, since the actual save flow
   * (opening SaveProjectDialog the first time, the quick-save toast) is
   * local state owned by ScreenRecorderApp, not something this store or the
   * editor-page-scoped shortcut hook has access to.
   */
  saveRequestToken: number;
  requestSave: () => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  route: 'library',
  setRoute: (route) => set({ route }),
  isRecording: false,
  setIsRecording: (isRecording) => set({ isRecording }),
  isRecorderToolbarOpen: false,
  setRecorderToolbarOpen: (isRecorderToolbarOpen) => set({ isRecorderToolbarOpen }),
  lastRecording: null,
  setLastRecording: (lastRecording) => set({ lastRecording }),
  clearLastRecording: () => set({ lastRecording: null, sourceResolution: null }),
  sourceResolution: null,
  setSourceResolution: (sourceResolution) => set({ sourceResolution }),
  isOpeningProject: false,
  setIsOpeningProject: (isOpeningProject) => set({ isOpeningProject }),
  projectName: 'Untitled Recording',
  setProjectName: (projectName) => set({ projectName }),
  currentProjectId: null,
  setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
  projectsVersion: 0,
  bumpProjectsVersion: () => set((state) => ({ projectsVersion: state.projectsVersion + 1 })),
  sidebarWidth: 288,
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  toolPanelWidth: 280,
  setToolPanelWidth: (toolPanelWidth) => set({ toolPanelWidth }),
  timelinePanelHeight: 180,
  setTimelinePanelHeight: (timelinePanelHeight) => set({ timelinePanelHeight }),
  saveRequestToken: 0,
  requestSave: () => set((state) => ({ saveRequestToken: state.saveRequestToken + 1 }))
}));

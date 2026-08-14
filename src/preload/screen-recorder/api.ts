import { ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  CaptureSource,
  RecordingRequest,
  RecordingSession
} from '@screen-recorder/types/recording';
import type { Project, ProjectSummary, CursorPathPoint } from '@screen-recorder/types/project';
import type { ExportFormat } from '@screen-recorder/types/export';
import type {
  AccessibilityStatus,
  AutomationStatus,
  CameraStatus,
  MicrophoneStatus,
  ScreenRecordingStatus
} from '@screen-recorder/types/permissions';
import type {
  ScreenRect,
  CaptureRegionSelection,
  SelectCaptureRegionOptions,
  RegionSelectCompletePayload
} from '@shared/capture-region';
import type {
  RecorderToolbarOpenPayload,
  RecorderToolbarStartPayload,
  RecorderToolbarRecordingResult
} from '@shared/recorder-toolbar';
import type { SourcePickerOverlayOpenOptions } from '@shared/source-picker-overlay';
import type {
  CaptureToolbarCapturePayload,
  CaptureToolbarOpenPayload
} from '@shared/capture-toolbar';
import type { CaptureDelaySetting } from '@shared/capture-delay';
import type { CaptureSourcePickerOverlayOpenOptions } from '@shared/capture-source-picker-overlay';
import type {
  NativeRecordingRequest,
  NativeRecordingSupport,
  NativeRecordingStartResult,
  NativeRecordingStopResult
} from '@shared/native-capture';

export const screenRecorderApi = {
  recording: {
    getCaptureSources: (): Promise<CaptureSource[]> =>
      ipcRenderer.invoke(IpcChannels.GetCaptureSources),
    /** Whether getDisplayMedia() can hand off to the native macOS 15+ ScreenCaptureKit picker. */
    supportsNativeSystemPicker: (): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.GetNativePickerSupport),
    start: (request: RecordingRequest): Promise<RecordingSession> =>
      ipcRenderer.invoke(IpcChannels.StartRecording, request),
    stop: (): Promise<void> => ipcRenderer.invoke(IpcChannels.StopRecording),
    saveFile: (fileName: string, data: ArrayBuffer): Promise<string> =>
      ipcRenderer.invoke(IpcChannels.SaveRecordingFile, fileName, data),
    deleteFile: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.DeleteRecordingFile, filePath),
    /** Opens a recording file in the OS's default player -- for Sidebar's "Recent" entries that aren't the live in-session `lastRecording`. */
    openFile: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OpenRecordingFile, filePath),
    /** Fresh on-screen bounds for a window source (by its desktopCapturer id) right now, or null if it can't be resolved (source isn't a window, window closed, unsupported platform). */
    refreshWindowBounds: (sourceId: string): Promise<CaptureSource['displayBounds'] | null> =>
      ipcRenderer.invoke(IpcChannels.RefreshWindowBounds, sourceId)
  },
  /**
   * Native platform recording -- a standalone helper subprocess
   * (ScreenCaptureKit/Windows.Graphics.Capture) that owns the whole
   * capture+encode+mux pipeline and writes the finished file directly, no
   * frame streaming back to the renderer at all. See recording-helper.ts
   * (main) and capture-engine.ts (renderer consumer).
   */
  nativeRecording: {
    checkSupport: (): Promise<NativeRecordingSupport> =>
      ipcRenderer.invoke(IpcChannels.NativeRecordingCheckSupport),
    start: (request: NativeRecordingRequest): Promise<NativeRecordingStartResult> =>
      ipcRenderer.invoke(IpcChannels.NativeRecordingStart, request),
    pause: (): Promise<void> => ipcRenderer.invoke(IpcChannels.NativeRecordingPause),
    resume: (): Promise<void> => ipcRenderer.invoke(IpcChannels.NativeRecordingResume),
    stop: (): Promise<NativeRecordingStopResult> =>
      ipcRenderer.invoke(IpcChannels.NativeRecordingStop)
  },
  cursor: {
    /**
     * `followWindowId` (a window's native handle, see parseWindowSourceId)
     * opts into live bounds-following for the duration of the recording --
     * pass null for a screen source, a native-picker source, or a window
     * source with a fixed crop region already overriding `bounds`.
     */
    startTracking: (
      bounds: { x: number; y: number; width: number; height: number },
      startedAt: number,
      followWindowId: number | null
    ): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.StartCursorTracking, bounds, startedAt, followWindowId),
    stopTracking: (): Promise<void> => ipcRenderer.invoke(IpcChannels.StopCursorTracking),
    onSample: (callback: (sample: CursorPathPoint) => void): (() => void) => {
      const listener = (_event: unknown, sample: CursorPathPoint): void => callback(sample);
      ipcRenderer.on(IpcChannels.CursorPositionSample, listener);
      return () => ipcRenderer.removeListener(IpcChannels.CursorPositionSample, listener);
    },
    onClickSample: (callback: (sample: CursorPathPoint) => void): (() => void) => {
      const listener = (_event: unknown, sample: CursorPathPoint): void => callback(sample);
      ipcRenderer.on(IpcChannels.CursorClickSample, listener);
      return () => ipcRenderer.removeListener(IpcChannels.CursorClickSample, listener);
    }
  },
  project: {
    open: (projectId: string): Promise<Project | null> =>
      ipcRenderer.invoke(IpcChannels.OpenProject, projectId),
    save: (project: Project): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.SaveProject, project),
    list: (): Promise<ProjectSummary[]> => ipcRenderer.invoke(IpcChannels.ListProjects),
    remove: (projectId: string): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.DeleteProject, projectId)
  },
  export: {
    /** Reads a local file's raw bytes for the in-renderer WebCodecs export pipeline (feeding the WASM demuxer) -- unbounded, unlike file-explorer's preview-scoped binary read. */
    readFileBytes: (filePath: string): Promise<ArrayBuffer> =>
      ipcRenderer.invoke(IpcChannels.ExportReadFileBytes, filePath),
    /** Cheap stat -- see ExportGetFileSize's doc in export-handlers.ts. */
    getFileSize: (filePath: string): Promise<number> =>
      ipcRenderer.invoke(IpcChannels.ExportGetFileSize, filePath),
    /** Writes the finished export's bytes to the already-chosen output path (see dialog.showSaveExportPath). */
    writeFileBytes: (filePath: string, data: ArrayBuffer): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.ExportWriteFileBytes, filePath, data),
    /** A safe OS-temp-dir path for `fileName` -- "Copy to clipboard" exports here instead of a user-chosen path. */
    getTempPath: (fileName: string): Promise<string> =>
      ipcRenderer.invoke(IpcChannels.ExportGetTempPath, fileName),
    /** Writes an already-exported file's path to the system clipboard as a file reference (pastes as the real file in Finder/Mail/Slack/...). */
    copyToClipboard: (filePath: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.ExportCopyToClipboard, filePath)
  },
  settings: {
    get: (): Promise<Record<string, unknown>> => ipcRenderer.invoke(IpcChannels.GetSettings),
    set: (patch: Record<string, unknown>): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IpcChannels.SetSettings, patch)
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowMinimize),
    hide: (options?: { mainOnly?: boolean }): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.WindowHide, options),
    restore: (options?: { focus?: boolean }): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.WindowRestore, options),
    setBackgroundThrottling: (allowed: boolean): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.WindowSetBackgroundThrottling, allowed),
    /** Recorder toolbar only: click-through for its transparent regions -- see recorder-toolbar-window.ts. */
    setIgnoreMouseEvents: (ignore: boolean): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.WindowSetIgnoreMouseEvents, ignore),
    /** Recorder toolbar only: current on-screen rect of the pill, so the main-process interactive-region poll (recorder-toolbar-window.ts) knows where it is. Pass null while nothing's rendered. */
    reportInteractiveRegion: (region: ScreenRect | null): void =>
      ipcRenderer.send(IpcChannels.WindowReportInteractiveRegion, region),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowToggleMaximize),
    close: (): Promise<void> => ipcRenderer.invoke(IpcChannels.WindowClose),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.WindowIsMaximized),
    onMaximizeChanged: (callback: (isMaximized: boolean) => void): (() => void) => {
      const listener = (_event: unknown, isMaximized: boolean): void => callback(isMaximized);
      ipcRenderer.on(IpcChannels.WindowMaximizeChanged, listener);
      return () => ipcRenderer.removeListener(IpcChannels.WindowMaximizeChanged, listener);
    }
  },
  permissions: {
    getScreenRecordingStatus: (): Promise<ScreenRecordingStatus> =>
      ipcRenderer.invoke(IpcChannels.GetScreenRecordingStatus),
    openScreenRecordingSettings: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OpenScreenRecordingSettings),
    getMicrophoneStatus: (): Promise<MicrophoneStatus> =>
      ipcRenderer.invoke(IpcChannels.GetMicrophoneStatus),
    openMicrophoneSettings: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OpenMicrophoneSettings),
    requestMicrophoneAccess: (): Promise<MicrophoneStatus> =>
      ipcRenderer.invoke(IpcChannels.RequestMicrophoneAccess),
    relaunchApp: (): Promise<void> => ipcRenderer.invoke(IpcChannels.RelaunchApp),
    getCameraStatus: (): Promise<CameraStatus> => ipcRenderer.invoke(IpcChannels.GetCameraStatus),
    openCameraSettings: (): Promise<void> => ipcRenderer.invoke(IpcChannels.OpenCameraSettings),
    requestCameraAccess: (): Promise<CameraStatus> =>
      ipcRenderer.invoke(IpcChannels.RequestCameraAccess),
    getAccessibilityStatus: (): Promise<AccessibilityStatus> =>
      ipcRenderer.invoke(IpcChannels.GetAccessibilityStatus),
    requestAccessibilityAccess: (): Promise<AccessibilityStatus> =>
      ipcRenderer.invoke(IpcChannels.RequestAccessibilityAccess),
    openAccessibilitySettings: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OpenAccessibilitySettings),
    requestAutomationAccess: (): Promise<AutomationStatus> =>
      ipcRenderer.invoke(IpcChannels.RequestAutomationAccess),
    openAutomationSettings: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OpenAutomationSettings)
  },
  dialog: {
    showSaveExportPath: (defaultFileName: string, format: ExportFormat): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannels.ShowSaveExportDialog, defaultFileName, format),
    /** Native "openFile" picker restricted to video extensions -- Sidebar's "Import" button. */
    showOpenVideo: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.ShowOpenVideoDialog)
  },
  simulator: {
    /** Name of the currently booted iOS Simulator device, or null if none is booted / Xcode Command Line Tools aren't installed. */
    getBootedName: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.GetBootedSimulator)
  },
  tray: {
    onOpenRecordPicker: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on(IpcChannels.TrayOpenRecordPicker, listener);
      return () => ipcRenderer.removeListener(IpcChannels.TrayOpenRecordPicker, listener);
    },
    onSourceSelected: (callback: (source: CaptureSource) => void): (() => void) => {
      const listener = (_event: unknown, source: CaptureSource): void => callback(source);
      ipcRenderer.on(IpcChannels.TraySourceSelected, listener);
      return () => ipcRenderer.removeListener(IpcChannels.TraySourceSelected, listener);
    },
    onOpenTool: (callback: (tool: string) => void): (() => void) => {
      const listener = (_event: unknown, tool: string): void => callback(tool);
      ipcRenderer.on(IpcChannels.TrayOpenTool, listener);
      return () => ipcRenderer.removeListener(IpcChannels.TrayOpenTool, listener);
    }
  },
  screenshot: {
    capture: (
      sourceId: string,
      options?: {
        displayId?: string;
        hideBeforeCapture?: boolean;
        focusAfterRestore?: boolean;
      }
    ): Promise<ArrayBuffer> =>
      ipcRenderer.invoke(IpcChannels.CaptureScreenshot, { sourceId, ...options }),
    captureRegion: (rect: ScreenRect): Promise<ArrayBuffer> =>
      ipcRenderer.invoke(IpcChannels.CaptureRegion, rect),
    copy: (data: ArrayBuffer): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.CopyScreenshot, data),
    save: (data: ArrayBuffer, defaultFileName: string): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannels.SaveScreenshot, data, defaultFileName),
    selectRegion: (options?: SelectCaptureRegionOptions): Promise<CaptureRegionSelection | null> =>
      ipcRenderer.invoke(IpcChannels.SelectCaptureRegion, options),
    capturePortal: (options?: { hideApp?: boolean }): Promise<ArrayBuffer | null> =>
      ipcRenderer.invoke(IpcChannels.CaptureScreenshotPortal, options)
  },
  regionSelect: {
    getContentOrigin: (): Promise<ScreenRect | null> =>
      ipcRenderer.invoke(IpcChannels.RegionSelectGetContentOrigin),
    getBackdrop: (): Promise<ArrayBuffer | string | null> =>
      ipcRenderer.invoke(IpcChannels.RegionSelectGetBackdrop),
    complete: (payload: RegionSelectCompletePayload): void =>
      ipcRenderer.send(IpcChannels.RegionSelectComplete, payload),
    cancel: (): void => ipcRenderer.send(IpcChannels.RegionSelectCancel)
  },
  recorderToolbar: {
    /** Called by the main window when a source is double-clicked. */
    open: (payload: RecorderToolbarOpenPayload): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.RecorderToolbarOpen, payload),
    /** Called by the toolbar window itself (Esc / close button). */
    cancel: (): void => ipcRenderer.send(IpcChannels.RecorderToolbarCancel),
    /** Called by the toolbar window's Area picker: bounds of whichever display the toolbar itself currently sits on. */
    getCurrentDisplayBounds: (): Promise<ScreenRect | null> =>
      ipcRenderer.invoke(IpcChannels.RecorderToolbarGetCurrentDisplayBounds),
    /** Called by the toolbar window's Start Recording button. */
    requestStart: (payload: RecorderToolbarStartPayload): void =>
      ipcRenderer.send(IpcChannels.RecorderToolbarStart, payload),
    /** Called by the toolbar window's Stop button once recording. */
    requestStop: (): void => ipcRenderer.send(IpcChannels.RecorderToolbarStop),
    /** Called by the toolbar window's Restart button once recording. */
    requestRestart: (): void => ipcRenderer.send(IpcChannels.RecorderToolbarRestart),
    /** Called by the toolbar window's Delete button once recording. */
    requestDelete: (): void => ipcRenderer.send(IpcChannels.RecorderToolbarDelete),
    /** Called by the main window once its start attempt settles. */
    reportRecordingStarted: (result: RecorderToolbarRecordingResult): void =>
      ipcRenderer.send(IpcChannels.RecorderToolbarRecordingStarted, result),
    /** Called by the main window once stop/save/editor-navigate finishes. */
    reportRecordingStopped: (): void =>
      ipcRenderer.send(IpcChannels.RecorderToolbarRecordingStopped),
    /** Main window: the toolbar has actually closed (cancelled or stopped) -- see ScreenRecorderSidebar.tsx's "Launch Recorder" disabled state. */
    onClosed: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on(IpcChannels.RecorderToolbarClosed, listener);
      return () => ipcRenderer.removeListener(IpcChannels.RecorderToolbarClosed, listener);
    },
    /** Main window: the toolbar wants a recording started with this config. */
    onStartRequested: (callback: (payload: RecorderToolbarStartPayload) => void): (() => void) => {
      const listener = (_event: unknown, payload: RecorderToolbarStartPayload): void =>
        callback(payload);
      ipcRenderer.on(IpcChannels.RecorderToolbarStartRequested, listener);
      return () => ipcRenderer.removeListener(IpcChannels.RecorderToolbarStartRequested, listener);
    },
    /** Main window: the toolbar's Stop button was clicked. */
    onStopRequested: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on(IpcChannels.RecorderToolbarStopRequested, listener);
      return () => ipcRenderer.removeListener(IpcChannels.RecorderToolbarStopRequested, listener);
    },
    /** Main window: the toolbar's Restart button was clicked. */
    onRestartRequested: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on(IpcChannels.RecorderToolbarRestartRequested, listener);
      return () =>
        ipcRenderer.removeListener(IpcChannels.RecorderToolbarRestartRequested, listener);
    },
    /** Main window: the toolbar's Delete button was clicked. */
    onDeleteRequested: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on(IpcChannels.RecorderToolbarDeleteRequested, listener);
      return () => ipcRenderer.removeListener(IpcChannels.RecorderToolbarDeleteRequested, listener);
    },
    /** Toolbar window: whether the main window's start attempt succeeded. */
    onRecordingResult: (
      callback: (result: RecorderToolbarRecordingResult) => void
    ): (() => void) => {
      const listener = (_event: unknown, result: RecorderToolbarRecordingResult): void =>
        callback(result);
      ipcRenderer.on(IpcChannels.RecorderToolbarRecordingStarted, listener);
      return () =>
        ipcRenderer.removeListener(IpcChannels.RecorderToolbarRecordingStarted, listener);
    },
    /** Called by the toolbar window's Display/Window tabs to open the click-to-record overlay. */
    openSourcePicker: (options: SourcePickerOverlayOpenOptions): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.SourcePickerOverlayOpen, options)
  },
  sourcePickerOverlay: {
    /** Called by the overlay window itself (Esc / click outside a card, or once a started recording's result has been handled -- see SourcePickerOverlayApp.tsx). Closes the overlay and restores the toolbar window either way. */
    cancel: (): void => ipcRenderer.send(IpcChannels.SourcePickerOverlayCancel)
  },
  captureToolbar: {
    open: (payload: CaptureToolbarOpenPayload): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.CaptureToolbarOpen, payload),
    isSessionActive: (): Promise<boolean> =>
      ipcRenderer.invoke(IpcChannels.CaptureToolbarIsSessionActive),
    cancel: (): void => ipcRenderer.send(IpcChannels.CaptureToolbarCancel),
    getCurrentDisplayBounds: (): Promise<ScreenRect | null> =>
      ipcRenderer.invoke(IpcChannels.CaptureToolbarGetCurrentDisplayBounds),
    requestCapture: (payload: CaptureToolbarCapturePayload): void =>
      ipcRenderer.send(IpcChannels.CaptureToolbarCapture, payload),
    setDelay: (delaySeconds: CaptureDelaySetting): void =>
      ipcRenderer.send(IpcChannels.CaptureToolbarDelayChanged, delaySeconds),
    onCountdown: (callback: (payload: CaptureToolbarCapturePayload) => void): (() => void) => {
      const listener = (_event: unknown, payload: CaptureToolbarCapturePayload): void =>
        callback(payload);
      ipcRenderer.on(IpcChannels.CaptureToolbarCountdown, listener);
      return () => ipcRenderer.removeListener(IpcChannels.CaptureToolbarCountdown, listener);
    },
    reportCaptured: (): void => ipcRenderer.send(IpcChannels.CaptureToolbarCaptured),
    onClosed: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on(IpcChannels.CaptureToolbarClosed, listener);
      return () => ipcRenderer.removeListener(IpcChannels.CaptureToolbarClosed, listener);
    },
    onCaptureRequested: (
      callback: (payload: CaptureToolbarCapturePayload) => void
    ): (() => void) => {
      const listener = (_event: unknown, payload: CaptureToolbarCapturePayload): void =>
        callback(payload);
      ipcRenderer.on(IpcChannels.CaptureToolbarCaptureRequested, listener);
      return () => ipcRenderer.removeListener(IpcChannels.CaptureToolbarCaptureRequested, listener);
    },
    onDelayChanged: (callback: (delaySeconds: CaptureDelaySetting) => void): (() => void) => {
      const listener = (_event: unknown, delaySeconds: CaptureDelaySetting): void =>
        callback(delaySeconds);
      ipcRenderer.on(IpcChannels.CaptureToolbarDelayChanged, listener);
      return () => ipcRenderer.removeListener(IpcChannels.CaptureToolbarDelayChanged, listener);
    },
    onSourcePickerClosed: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on(IpcChannels.CaptureSourcePickerOverlayClosed, listener);
      return () =>
        ipcRenderer.removeListener(IpcChannels.CaptureSourcePickerOverlayClosed, listener);
    },
    openSourcePicker: (options: CaptureSourcePickerOverlayOpenOptions): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.CaptureSourcePickerOverlayOpen, options)
  },
  captureSourcePickerOverlay: {
    cancel: (): void => ipcRenderer.send(IpcChannels.CaptureSourcePickerOverlayCancel)
  }
};

export type ScreenRecorderApi = typeof screenRecorderApi;

import { ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  CaptureSource,
  RecordingRequest,
  RecordingSession
} from '@screen-recorder/types/recording';
import type { Project, CursorPathPoint } from '@screen-recorder/types/project';
import type { ExportFormat } from '@screen-recorder/types/export';
import type { ScreenRecordingStatus } from '@screen-recorder/types/permissions';
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
      ipcRenderer.invoke(IpcChannels.DeleteRecordingFile, filePath)
  },
  cursor: {
    startTracking: (
      bounds: { x: number; y: number; width: number; height: number },
      startedAt: number
    ): Promise<void> => ipcRenderer.invoke(IpcChannels.StartCursorTracking, bounds, startedAt),
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
      ipcRenderer.invoke(IpcChannels.SaveProject, project)
  },
  export: {
    /** Reads a local file's raw bytes for the in-renderer WebCodecs export pipeline (feeding the WASM demuxer) -- unbounded, unlike file-explorer's preview-scoped binary read. */
    readFileBytes: (filePath: string): Promise<ArrayBuffer> =>
      ipcRenderer.invoke(IpcChannels.ExportReadFileBytes, filePath),
    /** Writes the finished export's bytes to the already-chosen output path (see dialog.showSaveExportPath). */
    writeFileBytes: (filePath: string, data: ArrayBuffer): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.ExportWriteFileBytes, filePath, data)
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
    /** Recorder toolbar only: click-through for its transparent regions -- see window-handlers.ts. */
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.WindowSetIgnoreMouseEvents, ignore, options),
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
      ipcRenderer.invoke(IpcChannels.OpenScreenRecordingSettings)
  },
  dialog: {
    showSaveExportPath: (defaultFileName: string, format: ExportFormat): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannels.ShowSaveExportDialog, defaultFileName, format)
  },
  simulator: {
    /** Name of the currently booted iOS Simulator device, or null if none is booted / Xcode Command Line Tools aren't installed. */
    getBootedName: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.GetBootedSimulator),
    /** Fresh AppleScript-resolved bounds of the Simulator window right now, or null if none is booted / its window isn't open. */
    refreshWindowBounds: (): Promise<CaptureSource['displayBounds'] | null> =>
      ipcRenderer.invoke(IpcChannels.RefreshSimulatorWindowBounds)
  },
  tray: {
    /** Creates the tray icon, if it doesn't already exist. */
    register: (): Promise<void> => ipcRenderer.invoke(IpcChannels.TrayRegister),
    /** Destroys the tray icon, if one exists. */
    unregister: (): Promise<void> => ipcRenderer.invoke(IpcChannels.TrayUnregister),
    onOpenRecordPicker: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on(IpcChannels.TrayOpenRecordPicker, listener);
      return () => ipcRenderer.removeListener(IpcChannels.TrayOpenRecordPicker, listener);
    },
    onSourceSelected: (callback: (source: CaptureSource) => void): (() => void) => {
      const listener = (_event: unknown, source: CaptureSource): void => callback(source);
      ipcRenderer.on(IpcChannels.TraySourceSelected, listener);
      return () => ipcRenderer.removeListener(IpcChannels.TraySourceSelected, listener);
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
    /** Called by the toolbar window's Start Recording button. */
    requestStart: (payload: RecorderToolbarStartPayload): void =>
      ipcRenderer.send(IpcChannels.RecorderToolbarStart, payload),
    /** Called by the toolbar window's Stop button once recording. */
    requestStop: (): void => ipcRenderer.send(IpcChannels.RecorderToolbarStop),
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
      ipcRenderer.invoke(IpcChannels.SourcePickerOverlayOpen, options),
    /** Toolbar window: a source was picked in the overlay -- apply it and start recording. */
    onSourcePicked: (callback: (sourceId: string) => void): (() => void) => {
      const listener = (_event: unknown, sourceId: string): void => callback(sourceId);
      ipcRenderer.on(IpcChannels.SourcePickerOverlayPicked, listener);
      return () => ipcRenderer.removeListener(IpcChannels.SourcePickerOverlayPicked, listener);
    }
  },
  sourcePickerOverlay: {
    /** Called by the overlay window itself when a display/window card is clicked. */
    pick: (sourceId: string): void =>
      ipcRenderer.send(IpcChannels.SourcePickerOverlayPick, sourceId),
    /** Called by the overlay window itself (Esc / click outside a card). */
    cancel: (): void => ipcRenderer.send(IpcChannels.SourcePickerOverlayCancel)
  }
};

export type ScreenRecorderApi = typeof screenRecorderApi;

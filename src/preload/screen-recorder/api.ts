import { ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  CaptureSource,
  RecordingRequest,
  RecordingSession
} from '@screen-recorder/types/recording';
import type { Project, CursorPathPoint } from '@screen-recorder/types/project';
import type { ExportFormat, ExportOptions, ExportProgress } from '@screen-recorder/types/export';
import type { ScreenRecordingStatus } from '@screen-recorder/types/permissions';
import type { ScreenRect } from '@shared/capture-region';

export const screenRecorderApi = {
  recording: {
    getCaptureSources: (): Promise<CaptureSource[]> =>
      ipcRenderer.invoke(IpcChannels.GetCaptureSources),
    start: (request: RecordingRequest): Promise<RecordingSession> =>
      ipcRenderer.invoke(IpcChannels.StartRecording, request),
    stop: (): Promise<void> => ipcRenderer.invoke(IpcChannels.StopRecording),
    saveFile: (fileName: string, data: ArrayBuffer): Promise<string> =>
      ipcRenderer.invoke(IpcChannels.SaveRecordingFile, fileName, data)
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
    start: (options: ExportOptions): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.ExportVideo, options),
    onProgress: (callback: (progress: ExportProgress) => void): (() => void) => {
      const listener = (_event: unknown, progress: ExportProgress): void => callback(progress);
      ipcRenderer.on(IpcChannels.ExportProgress, listener);
      return () => ipcRenderer.removeListener(IpcChannels.ExportProgress, listener);
    }
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
      copy: (data: ArrayBuffer): Promise<void> =>
        ipcRenderer.invoke(IpcChannels.CopyScreenshot, data),
      save: (data: ArrayBuffer, defaultFileName: string): Promise<string | null> =>
        ipcRenderer.invoke(IpcChannels.SaveScreenshot, data, defaultFileName),
      selectRegion: (): Promise<import('@shared/capture-region').CaptureRegionSelection | null> =>
        ipcRenderer.invoke(IpcChannels.SelectCaptureRegion),
      pickOsSource: (options?: {
        monitorOnly?: boolean;
      }): Promise<import('@shared/os-picker-source').OsPickerSource | null> =>
        ipcRenderer.invoke(IpcChannels.PickOsCaptureSource, options)
    },
    regionSelect: {
      complete: (rect: ScreenRect): void =>
        ipcRenderer.send(IpcChannels.RegionSelectComplete, rect),
      cancel: (): void => ipcRenderer.send(IpcChannels.RegionSelectCancel)
    }
  }
};

export type ScreenRecorderApi = typeof screenRecorderApi;

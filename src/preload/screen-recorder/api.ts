import { ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type {
  CaptureSource,
  RecordingRequest,
  RecordingSession
} from '@screen-recorder/types/recording';
import type { Project } from '@screen-recorder/types/project';
import type { ExportFormat, ExportOptions, ExportProgress } from '@screen-recorder/types/export';
import type { ScreenRecordingStatus } from '@screen-recorder/types/permissions';

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
  }
};

export type ScreenRecorderApi = typeof screenRecorderApi;

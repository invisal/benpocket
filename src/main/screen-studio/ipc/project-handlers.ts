import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { Project } from '@screen-studio/types/project';

// TODO: back this with real file I/O (read/write project JSON + media assets)
export function registerProjectHandlers(): void {
  ipcMain.handle(IpcChannels.OpenProject, (): Project | null => {
    return null;
  });

  ipcMain.handle(IpcChannels.SaveProject, (): boolean => {
    return false;
  });
}

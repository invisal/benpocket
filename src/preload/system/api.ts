import { ipcRenderer } from 'electron';

export interface AppProcessMetric {
  pid: number;
  type: string;
  name?: string;
  workingSetSizeKb: number;
  /** @platform win32 */
  privateBytesKb?: number;
  cpuPercent: number;
}

export interface SystemApi {
  getAppMetrics: () => Promise<AppProcessMetric[]>;
}

export const systemApi: SystemApi = {
  getAppMetrics: () => ipcRenderer.invoke('system:get-app-metrics')
};

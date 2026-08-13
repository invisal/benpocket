import { app, ipcMain } from 'electron';
import type { AppProcessMetric } from '../../preload/system/api';

// Backs the status bar's memory indicator -- lets us see per-process (main,
// renderer, GPU, utility) memory without alt-tabbing to Task Manager.
export function registerSystemHandlers(): void {
  ipcMain.handle('system:get-app-metrics', (): AppProcessMetric[] =>
    app.getAppMetrics().map((metric) => ({
      pid: metric.pid,
      type: metric.type,
      name: metric.name ?? metric.serviceName,
      workingSetSizeKb: metric.memory.workingSetSize,
      privateBytesKb: metric.memory.privateBytes,
      cpuPercent: metric.cpu.percentCPUUsage
    }))
  );
}

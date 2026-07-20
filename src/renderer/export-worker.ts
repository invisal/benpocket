import { ipcRenderer } from '@screen-recorder/export-engine/node-bridge';
import { IpcChannels } from '@shared/ipc-channels';
import type { ExportOptions, ExportProgress } from '@screen-recorder/types/export';
import { exportOrchestrator } from '@screen-recorder/export-engine/export-orchestrator';

/**
 * Entry point for the hidden, `nodeIntegration: true` export window (see
 * export-worker-window.ts in main) -- the whole export pipeline (ffmpeg
 * decode/encode subprocesses, the nested PixiJS render Worker) runs here,
 * off the real UI window's process entirely. Only small messages
 * (`ExportOptions` in, `ExportProgress`/result out) cross back to main.
 */
ipcRenderer.on(IpcChannels.ExportWorkerRun, (_event, options: ExportOptions) => {
  void exportOrchestrator
    .export(options, (progress: ExportProgress) => {
      ipcRenderer.send(IpcChannels.ExportProgress, progress);
    })
    .then(
      () => ipcRenderer.send(IpcChannels.ExportWorkerResult, { ok: true }),
      (err: unknown) => {
        console.error('[export] failed:', err);
        ipcRenderer.send(IpcChannels.ExportWorkerResult, {
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    );
});

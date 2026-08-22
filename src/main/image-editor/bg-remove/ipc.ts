import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import sharp from 'sharp';
import { encodePipeline, toUint8Array, type EncodeResult } from '../index';
import { decodeRgba, recombineWithAlpha } from '../model/pixels';
import { BG_REMOVE_CANCELLED_MESSAGE, removeBackgroundAlpha } from './infer';
import { ensureModel, isModelCached, MODEL_DOWNLOAD_CANCELLED_MESSAGE } from './modelCache';
import { BG_REMOVE_MODELS, type BgRemoveModelId } from './models';

function cacheRoot(): string {
  return path.join(app.getPath('userData'), 'models', 'bg-remove');
}

export interface BgRemoveModelStatus {
  id: BgRemoveModelId;
  label: string;
  description: string;
  downloadSizeBytes: number;
  cached: boolean;
}

export type VoidResult = { error?: string };

// Same "one shared controller for the current run" shape as upscale's -- only one bg-remove
// operation (model download or inference) is ever in flight at a time, so a single AbortController
// is enough to support Cancel across the IPC boundary.
let currentRun: AbortController | null = null;

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload);
}

function findModel(id: string) {
  const model = BG_REMOVE_MODELS.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown background-removal model: ${id}`);
  return model;
}

export function registerBgRemoveHandlers(): void {
  ipcMain.handle('image-editor:bg-remove-models', async (): Promise<BgRemoveModelStatus[]> => {
    return Promise.all(
      BG_REMOVE_MODELS.map(async (model) => ({
        id: model.id,
        label: model.label,
        description: model.description,
        downloadSizeBytes: model.sizeBytes,
        cached: await isModelCached(cacheRoot(), model)
      }))
    );
  });

  ipcMain.handle(
    'image-editor:bg-remove-ensure-model',
    async (_, modelId: string): Promise<VoidResult> => {
      const model = findModel(modelId);
      const controller = new AbortController();
      currentRun = controller;
      try {
        await ensureModel(
          cacheRoot(),
          model,
          (percent) =>
            broadcast('image-editor:bg-remove-download-progress', { modelId: model.id, percent }),
          controller.signal
        );
        return {};
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message !== MODEL_DOWNLOAD_CANCELLED_MESSAGE) {
          console.error(`[image-editor:bg-remove-ensure-model] failed for ${modelId}:`, err);
        }
        return { error: message };
      } finally {
        currentRun = null;
      }
    }
  );

  ipcMain.handle(
    'image-editor:bg-remove',
    async (_, input: Uint8Array, mimeType: string, modelId: string): Promise<EncodeResult> => {
      const model = findModel(modelId);
      const controller = new AbortController();
      currentRun = controller;
      try {
        const { rgb } = await decodeRgba(input);
        const alpha = await removeBackgroundAlpha(cacheRoot(), model, rgb, controller.signal);
        const combined = await recombineWithAlpha(rgb, alpha);
        const pipeline = sharp(combined.data, {
          raw: { width: combined.width, height: combined.height, channels: combined.channels }
        });

        const data = await encodePipeline(pipeline, mimeType);
        return { data: toUint8Array(data) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message !== BG_REMOVE_CANCELLED_MESSAGE)
          console.error('[image-editor:bg-remove] failed:', err);
        return { error: message };
      } finally {
        currentRun = null;
      }
    }
  );

  ipcMain.handle('image-editor:bg-remove-cancel', (): void => {
    currentRun?.abort();
  });
}

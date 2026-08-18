import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import sharp from 'sharp';
import { encodePipeline, toUint8Array, type EncodeResult } from '../index';
import { UPSCALE_CANCELLED_MESSAGE, upscaleRgb } from './infer';
import { ensureModel, isModelCached, MODEL_DOWNLOAD_CANCELLED_MESSAGE } from './modelCache';
import { UPSCALE_MODELS, type UpscaleModelId } from './models';
import { decodeRgba, recombineWithAlpha } from '../model/pixels';

function cacheRoot(): string {
  return path.join(app.getPath('userData'), 'models');
}

export interface UpscaleModelStatus {
  id: UpscaleModelId;
  label: string;
  description: string;
  scale: number;
  downloadSizeBytes: number;
  cached: boolean;
}

export type VoidResult = { error?: string };

// Only one upscale-related operation (model download or inference) is ever in flight at a time --
// the renderer's Apply button is disabled while running -- so a single shared controller for
// "the current run" is enough to support Cancel, same idea as `runInpaint`'s AbortController but
// crossing the IPC boundary instead of staying in one process.
let currentRun: AbortController | null = null;

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload);
}

function findModel(id: string) {
  const model = UPSCALE_MODELS.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown upscale model: ${id}`);
  return model;
}

export function registerUpscaleHandlers(): void {
  ipcMain.handle('image-editor:upscale-models', async (): Promise<UpscaleModelStatus[]> => {
    return Promise.all(
      UPSCALE_MODELS.map(async (model) => ({
        id: model.id,
        label: model.label,
        description: model.description,
        scale: model.scale,
        downloadSizeBytes: model.archiveSizeBytes,
        cached: await isModelCached(cacheRoot(), model)
      }))
    );
  });

  ipcMain.handle(
    'image-editor:upscale-ensure-model',
    async (_, modelId: string): Promise<VoidResult> => {
      const model = findModel(modelId);
      const controller = new AbortController();
      currentRun = controller;
      try {
        await ensureModel(
          cacheRoot(),
          model,
          (percent) =>
            broadcast('image-editor:upscale-download-progress', { modelId: model.id, percent }),
          controller.signal
        );
        return {};
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message !== MODEL_DOWNLOAD_CANCELLED_MESSAGE) {
          console.error(`[image-editor:upscale-ensure-model] failed for ${modelId}:`, err);
        }
        return { error: message };
      } finally {
        currentRun = null;
      }
    }
  );

  ipcMain.handle(
    'image-editor:upscale',
    async (
      _,
      input: Uint8Array,
      mimeType: string,
      modelId: string,
      targetScale: number
    ): Promise<EncodeResult> => {
      const model = findModel(modelId);
      const controller = new AbortController();
      currentRun = controller;
      try {
        const { rgb, alpha } = await decodeRgba(input);
        const upscaled = await upscaleRgb(
          cacheRoot(),
          model,
          rgb,
          (done, total) => broadcast('image-editor:upscale-progress', { done, total }),
          controller.signal
        );
        const combined = await recombineWithAlpha(upscaled, alpha);
        let pipeline = sharp(combined.data, {
          raw: { width: combined.width, height: combined.height, channels: combined.channels }
        });

        // The network only ever produces `model.scale`x -- a smaller requested scale is a plain
        // downsample of that result rather than a second, differently-shaped model run, same
        // trick chaiNNer/Topaz use for arbitrary ratios on a fixed-ratio network.
        const clampedScale = Math.min(model.scale, Math.max(1, targetScale));
        if (clampedScale < model.scale) {
          pipeline = pipeline.resize(
            Math.max(1, Math.round(rgb.width * clampedScale)),
            Math.max(1, Math.round(rgb.height * clampedScale)),
            { kernel: sharp.kernel.lanczos3 }
          );
        }

        const data = await encodePipeline(pipeline, mimeType);
        return { data: toUint8Array(data) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message !== UPSCALE_CANCELLED_MESSAGE)
          console.error('[image-editor:upscale] failed:', err);
        return { error: message };
      } finally {
        currentRun = null;
      }
    }
  );

  ipcMain.handle('image-editor:upscale-cancel', (): void => {
    currentRun?.abort();
  });
}

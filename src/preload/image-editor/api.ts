import { ipcRenderer, type IpcRendererEvent } from 'electron';

export type EncodeResponse = { data: Uint8Array } | { error: string };

export interface UpscaleModelStatus {
  id: 'x4v3' | 'x4plus';
  label: string;
  description: string;
  scale: number;
  downloadSizeBytes: number;
  cached: boolean;
}

export interface UpscaleDownloadProgress {
  modelId: string;
  percent: number;
}

export interface UpscaleProgress {
  done: number;
  total: number;
}

export interface ImageEditorApi {
  /**
   * `input` is a compressed image (the original file bytes, or whatever a previous resize/crop
   * call returned) -- runs through sharp in the main process and returns compressed bytes
   * (`mimeType`), ready to display (decode locally) and to write straight to disk on save.
   */
  resize: (
    input: Uint8Array,
    targetWidth: number,
    targetHeight: number,
    mimeType: string
  ) => Promise<EncodeResponse>;
  /** Same shape as `resize`, extracting a pixel rect instead. */
  crop: (
    input: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number,
    mimeType: string
  ) => Promise<EncodeResponse>;
  /** Plain re-encode with no geometry change (used by tools that synthesize pixels locally via
   * `lib/inpaint/`, e.g. Context-aware Resize/Removal, and only need the final compressed bytes). */
  encode: (input: Uint8Array, mimeType: string) => Promise<EncodeResponse>;
  /**
   * Text-to-image (and, given `referenceImage`, image-conditioned editing) via Cloudflare Workers
   * AI (FLUX.2 [klein]) -- runs entirely in the main process since it needs the Cloudflare API
   * token, which never reaches the renderer. `width`/`height`, when given, ask the model to
   * generate at that exact shape (e.g. matching the current image's aspect ratio, or a size the
   * user typed in) instead of its square default. Returns the generated image already re-encoded
   * to `mimeType`, same shape as resize/crop/encode.
   */
  generate: (
    prompt: string,
    mimeType: string,
    referenceImage?: Uint8Array,
    width?: number,
    height?: number
  ) => Promise<EncodeResponse>;
  /** Registry of local upscale models plus whether each is already cached on disk (see
   * `ensureUpscaleModel`), so the UI can show "will download ~N MB" up front. */
  getUpscaleModels: () => Promise<UpscaleModelStatus[]>;
  /** Downloads + verifies `modelId`'s weights into the userData model cache if not already
   * there; no-ops if it is. Progress pushed via `onUpscaleDownloadProgress`. */
  ensureUpscaleModel: (modelId: string) => Promise<{ error?: string }>;
  /** Runs `modelId` over `input` (compressed image bytes) entirely in the main process --
   * decode/tile/re-encode via sharp + onnxruntime-node, same round-trip shape as `resize`/`crop`.
   * Assumes the model is already cached; call `ensureUpscaleModel` first. Progress pushed via
   * `onUpscaleProgress`. `targetScale` (1 up to the model's native scale, e.g. 4) lets the caller
   * ask for less than the network's native ratio -- the main process runs the network at its
   * native scale regardless, then downsamples to `targetScale` in the same round trip. */
  upscale: (
    input: Uint8Array,
    mimeType: string,
    modelId: string,
    targetScale: number
  ) => Promise<EncodeResponse>;
  /** Aborts whichever of `ensureUpscaleModel`/`upscale` is currently running. */
  cancelUpscale: () => Promise<void>;
  onUpscaleDownloadProgress: (callback: (progress: UpscaleDownloadProgress) => void) => () => void;
  onUpscaleProgress: (callback: (progress: UpscaleProgress) => void) => () => void;
}

export const imageEditorApi: ImageEditorApi = {
  resize: (input, targetWidth, targetHeight, mimeType) =>
    ipcRenderer.invoke('image-editor:resize', input, targetWidth, targetHeight, mimeType),
  crop: (input, x, y, width, height, mimeType) =>
    ipcRenderer.invoke('image-editor:crop', input, x, y, width, height, mimeType),
  encode: (input, mimeType) => ipcRenderer.invoke('image-editor:encode', input, mimeType),
  generate: (prompt, mimeType, referenceImage, width, height) =>
    ipcRenderer.invoke('image-editor:generate', prompt, mimeType, referenceImage, width, height),
  getUpscaleModels: () => ipcRenderer.invoke('image-editor:upscale-models'),
  ensureUpscaleModel: (modelId) => ipcRenderer.invoke('image-editor:upscale-ensure-model', modelId),
  upscale: (input, mimeType, modelId, targetScale) =>
    ipcRenderer.invoke('image-editor:upscale', input, mimeType, modelId, targetScale),
  cancelUpscale: () => ipcRenderer.invoke('image-editor:upscale-cancel'),
  onUpscaleDownloadProgress: (callback) => {
    const listener = (_event: IpcRendererEvent, progress: UpscaleDownloadProgress): void =>
      callback(progress);
    ipcRenderer.on('image-editor:upscale-download-progress', listener);
    return () => ipcRenderer.removeListener('image-editor:upscale-download-progress', listener);
  },
  onUpscaleProgress: (callback) => {
    const listener = (_event: IpcRendererEvent, progress: UpscaleProgress): void =>
      callback(progress);
    ipcRenderer.on('image-editor:upscale-progress', listener);
    return () => ipcRenderer.removeListener('image-editor:upscale-progress', listener);
  }
};

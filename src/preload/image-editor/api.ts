import { ipcRenderer } from 'electron';

export type EncodeResponse = { data: Uint8Array } | { error: string };

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
}

export const imageEditorApi: ImageEditorApi = {
  resize: (input, targetWidth, targetHeight, mimeType) =>
    ipcRenderer.invoke('image-editor:resize', input, targetWidth, targetHeight, mimeType),
  crop: (input, x, y, width, height, mimeType) =>
    ipcRenderer.invoke('image-editor:crop', input, x, y, width, height, mimeType),
  encode: (input, mimeType) => ipcRenderer.invoke('image-editor:encode', input, mimeType)
};

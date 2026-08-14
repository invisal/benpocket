import { toPngBlob } from './capture-frame';
import { useCaptureEditorStore } from '../store/editor.store';
import type { ImageAnnotation } from '../types/editor';
import type { Rect } from './flatten';

/**
 * Center `natural` in `view`, scaled down to at most 80% of the view if it
 * would overflow. Native size when the image already fits.
 */
export function imageLayerRect(naturalWidth: number, naturalHeight: number, view: Rect): Rect {
  const maxW = Math.max(1, view.width * 0.8);
  const maxH = Math.max(1, view.height * 0.8);
  const scale = Math.min(1, maxW / naturalWidth, maxH / naturalHeight);
  const width = Math.max(1, naturalWidth * scale);
  const height = Math.max(1, naturalHeight * scale);
  return {
    x: view.x + (view.width - width) / 2,
    y: view.y + (view.height - height) / 2,
    width,
    height
  };
}

/** Decode an image and drop it on the editor as a selected layer. */
export async function addImageLayerFromBlob(source: Blob): Promise<void> {
  try {
    const blob = await toPngBlob(source);
    const bitmap = await createImageBitmap(blob);
    // blob: URL — short string shared across undo snapshots; revoked on editor reset.
    const src = URL.createObjectURL(blob);
    const store = useCaptureEditorStore.getState();
    const view = store.crop ?? {
      x: 0,
      y: 0,
      width: store.imageWidth || bitmap.width,
      height: store.imageHeight || bitmap.height
    };
    const rect = imageLayerRect(bitmap.width, bitmap.height, view);
    bitmap.close();
    const annotation: ImageAnnotation = {
      id: crypto.randomUUID(),
      kind: 'image',
      src,
      ...rect
    };
    store.addAnnotation(annotation);
    store.setTool('select');
  } catch (err) {
    console.error('Could not add image layer.', err);
  }
}

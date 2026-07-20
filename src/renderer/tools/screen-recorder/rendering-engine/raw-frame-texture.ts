import { BufferImageSource, Texture } from 'pixi.js';

/**
 * Wraps a raw RGBA `Uint8Array` (as decoded straight off ffmpeg's stdout, no
 * PNG/JPEG involved) as a PixiJS `Texture`, reused across frames and only
 * reallocated when the frame's own dimensions change (segments can have
 * different per-clip crops). `format: 'rgba8unorm'` is required explicitly --
 * `BufferImageSource`'s default for a `Uint8Array` resource is `bgra8unorm`,
 * which would silently swap the red/blue channels against what ffmpeg's
 * `-pix_fmt rgba` actually produces.
 */
export class RawFrameTexture {
  private source: BufferImageSource | null = null;
  readonly texture = new Texture({ source: Texture.EMPTY.source });
  private width = 0;
  private height = 0;

  update(buffer: Uint8Array, width: number, height: number): void {
    if (!this.source || this.width !== width || this.height !== height) {
      this.source?.destroy();
      this.width = width;
      this.height = height;
      this.source = new BufferImageSource({
        resource: buffer,
        width,
        height,
        format: 'rgba8unorm'
      });
      this.texture.source = this.source;
    } else {
      this.source.resource = buffer;
      this.source.update();
    }
  }

  destroy(): void {
    this.source?.destroy();
  }
}

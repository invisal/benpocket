import { autoDetectRenderer, Container, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import { AnnotationsEffect } from './effects/annotations';
import { BackgroundEffect } from './effects/background';
import { BlurMasksEffect } from './effects/blur-masks';
import { CaptionEffect } from './effects/captions';
import { CursorEffect } from './effects/cursor';
import { ShadowCornerEffect } from './effects/shadow-corner';
import { applyZoom } from './effects/zoom';
import { WebcamEffect } from './effects/webcam';
import type { PixelCropRect } from './crop';
import type { SceneDescription } from './types';

/** Wraps a `VideoFrame` as a PixiJS `Texture`, optionally cropped to a sub-rect (source pixel coordinates) via the texture's `frame`. Caller owns the `VideoFrame`'s lifetime -- must not `close()` it until after the render that uses this texture has happened. */
function textureFromVideoFrame(frame: VideoFrame, cropRect?: PixelCropRect): Texture {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Pixi's public TextureSourceLike union doesn't list VideoFrame, but ImageSource's runtime source-detection explicitly accepts it (`globalThis.VideoFrame && resource instanceof VideoFrame`).
  const base = Texture.from(frame as any);
  if (!cropRect) return base;
  return new Texture({
    source: base.source,
    frame: new Rectangle(cropRect.x, cropRect.y, cropRect.width, cropRect.height)
  });
}

/**
 * Owns a persistent PixiJS scene graph (built once, mutated per frame -- not
 * rebuilt from scratch every frame) that mirrors the layer/draw order:
 *
 *   background -> [zoom-transformed: shadow, [clipped: video, blur-masks,
 *   cursor]] -> webcam PiP -> annotations -> caption
 *
 * Consumes a `SceneDescription` (from `timeline-evaluator.ts`) plus the
 * decoded video/webcam `VideoFrame`s for one frame, and renders them onto its
 * `OffscreenCanvas`. No PixiJS type appears in `types.ts`/
 * `timeline-evaluator.ts` -- this is the only module that knows about PixiJS
 * at all.
 *
 * Unlike the earlier ffmpeg-subprocess-pipe version of this class, there is
 * no `extract.pixels()` call here: the caller wraps `getCanvas()` directly as
 * a `VideoFrame` for the WebCodecs `VideoEncoder` (`new VideoFrame(canvas,
 * {timestamp, duration})`), which is both simpler and avoids an extra full-
 * frame pixel readback+copy every frame.
 */
export class PixiSceneRenderer {
  private readonly stage = new Container();
  private readonly contentLayer = new Container();
  private readonly clippedContent = new Container();
  private readonly videoSprite = new Sprite();
  private videoTexture: Texture | null = null;

  private readonly background: BackgroundEffect;
  private readonly shadowCorner: ShadowCornerEffect;
  private readonly cursor: CursorEffect;
  private readonly webcam: WebcamEffect;
  private readonly blurMasks: BlurMasksEffect;
  private readonly annotations: AnnotationsEffect;
  private readonly caption: CaptionEffect;

  private constructor(private readonly renderer: Renderer) {
    this.background = new BackgroundEffect(this.stage);
    this.stage.addChild(this.contentLayer);
    this.shadowCorner = new ShadowCornerEffect(this.contentLayer, this.clippedContent);

    this.clippedContent.addChild(this.videoSprite);
    this.contentLayer.addChild(this.clippedContent);
    this.clippedContent.mask = this.shadowCorner.maskGraphics;

    this.blurMasks = new BlurMasksEffect(this.clippedContent);
    this.cursor = new CursorEffect(this.clippedContent);

    this.webcam = new WebcamEffect(this.stage);
    this.annotations = new AnnotationsEffect(this.stage);
    this.caption = new CaptionEffect(this.stage);
  }

  static async create(
    canvas: OffscreenCanvas,
    width: number,
    height: number
  ): Promise<PixiSceneRenderer> {
    const renderer = await autoDetectRenderer({
      canvas: canvas as unknown as HTMLCanvasElement,
      width,
      height,
      // Pinned explicitly so the exported frame's pixel dimensions always
      // exactly match `width x height` regardless of whatever this Worker's
      // `devicePixelRatio` happens to be -- HiDPI scaling here would
      // silently double the renderer's backing pixel size.
      resolution: 1,
      preference: ['webgl', 'webgpu'],
      antialias: false,
      backgroundAlpha: 1
    });
    const instance = new PixiSceneRenderer(renderer);
    instance.background.resize(width, height);
    return instance;
  }

  async renderFrame(
    scene: SceneDescription,
    videoFrame: VideoFrame,
    videoCropRect: PixelCropRect | undefined,
    webcamFrame?: VideoFrame,
    webcamCropRect?: PixelCropRect
  ): Promise<void> {
    await this.background.update(scene.background);
    applyZoom(this.contentLayer, scene.innerRect, scene.zoom);
    this.shadowCorner.update(scene.innerRect, scene.cornerRadiusPx, scene.shadow);

    // A fresh Texture is created per frame (VideoFrames aren't mutable/
    // reusable like the old raw-buffer approach) -- the previous one is
    // destroyed *after* the new one is assigned, matching the reference
    // implementation's leak-avoidance pattern.
    const oldVideoTexture = this.videoTexture;
    this.videoTexture = textureFromVideoFrame(videoFrame, videoCropRect);
    this.videoSprite.texture = this.videoTexture;
    oldVideoTexture?.destroy(true);

    this.videoSprite.x = scene.innerRect.x;
    this.videoSprite.y = scene.innerRect.y;
    this.videoSprite.width = scene.innerRect.width;
    this.videoSprite.height = scene.innerRect.height;

    this.blurMasks.update(scene.blurMasks, this.videoTexture, scene.innerRect);
    this.cursor.update(scene.cursor, scene.innerRect);

    let webcamTexture: Texture | undefined;
    if (webcamFrame) {
      webcamTexture = textureFromVideoFrame(webcamFrame, webcamCropRect);
    }
    this.webcam.update(scene.webcam, webcamTexture);

    await this.annotations.update(scene.annotations);
    this.caption.update(scene.caption, scene.outputWidth, scene.outputHeight, scene.referenceScale);

    this.renderer.render(this.stage);
    // Destroying the webcam texture only after render() has actually
    // uploaded/read it -- it's not retained across frames like the video
    // texture (webcam.ts always gets a fresh one when present, or none).
    webcamTexture?.destroy(true);
  }

  /** The canvas this renderer draws to -- wrap directly as `new VideoFrame(canvas, {timestamp, duration})` for encoding, no pixel extraction needed. */
  getCanvas(): OffscreenCanvas {
    return this.renderer.canvas as unknown as OffscreenCanvas;
  }

  destroy(): void {
    this.videoTexture?.destroy(true);
    this.renderer.destroy();
  }
}

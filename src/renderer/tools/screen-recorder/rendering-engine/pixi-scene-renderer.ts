import { autoDetectRenderer, Container, Rectangle, Sprite, type Renderer } from 'pixi.js';
import { AnnotationsEffect } from './effects/annotations';
import { BackgroundEffect } from './effects/background';
import { BlurMasksEffect } from './effects/blur-masks';
import { CaptionEffect } from './effects/captions';
import { CursorEffect } from './effects/cursor';
import { ShadowCornerEffect } from './effects/shadow-corner';
import { applyZoom } from './effects/zoom';
import { WebcamEffect } from './effects/webcam';
import { RawFrameTexture } from './raw-frame-texture';
import type { SceneDescription } from './types';

/**
 * Owns a persistent PixiJS scene graph (built once, mutated per frame -- not
 * rebuilt from scratch every frame) that mirrors frame-compositor.ts's
 * layer/draw order:
 *
 *   background -> [zoom-transformed: shadow, [clipped: video, blur-masks,
 *   cursor]] -> webcam PiP -> annotations -> caption
 *
 * Consumes a `SceneDescription` (from `timeline-evaluator.ts`) plus the raw
 * decoded video/webcam RGBA buffers for one frame, and returns the
 * composited RGBA pixels for that frame. No PixiJS type appears in
 * `types.ts`/`timeline-evaluator.ts` -- this is the only module that knows
 * about PixiJS at all.
 */
export class PixiSceneRenderer {
  private readonly stage = new Container();
  private readonly contentLayer = new Container();
  private readonly clippedContent = new Container();
  private readonly videoSprite = new Sprite();
  private readonly videoTexture = new RawFrameTexture();

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

    this.videoSprite.texture = this.videoTexture.texture;
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
      // exactly match `width x height` (what the ffmpeg encoder is told to
      // expect) regardless of whatever this Worker's `devicePixelRatio`
      // happens to be -- HiDPI scaling here would silently double the
      // renderer's backing pixel size.
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
    videoFrame: Uint8Array,
    videoFrameWidth: number,
    videoFrameHeight: number,
    webcamFrame?: { buffer: Uint8Array; size: number }
  ): Promise<Uint8Array> {
    await this.background.update(scene.background);
    applyZoom(this.contentLayer, scene.innerRect, scene.zoom);
    this.shadowCorner.update(scene.innerRect, scene.cornerRadiusPx, scene.shadow);

    this.videoTexture.update(videoFrame, videoFrameWidth, videoFrameHeight);
    this.videoSprite.texture = this.videoTexture.texture;
    this.videoSprite.x = scene.innerRect.x;
    this.videoSprite.y = scene.innerRect.y;
    this.videoSprite.width = scene.innerRect.width;
    this.videoSprite.height = scene.innerRect.height;

    this.blurMasks.update(scene.blurMasks, this.videoTexture.texture, scene.innerRect);
    this.cursor.update(scene.cursor, scene.innerRect);
    this.webcam.update(scene.webcam, webcamFrame);
    await this.annotations.update(scene.annotations);
    this.caption.update(scene.caption, scene.outputWidth, scene.outputHeight, scene.referenceScale);

    this.renderer.render(this.stage);
    // `frame` must be explicit: without it, `extract.pixels(container)`
    // measures the container's *dynamic content bounds* (which grow/shrink
    // frame to frame -- zoom scaling, BlurFilter's inherent edge padding,
    // etc.) instead of the fixed canvas size, so the returned buffer's byte
    // length silently varies per frame. The ffmpeg encoder is told a fixed
    // `width x height` raw-frame size (see video-encoder.ts's `-s`
    // argument); feeding it variably-sized buffers desyncs its byte-stream
    // framing, corrupting every frame after the first mismatch. Confirmed
    // by dumping an actual composited buffer -- it was ~2.9MB against an
    // expected 960x540x4 = ~2.07MB.
    const { pixels } = this.renderer.extract.pixels({
      target: this.stage,
      frame: new Rectangle(0, 0, scene.outputWidth, scene.outputHeight)
    });
    return new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  }

  destroy(): void {
    this.videoTexture.destroy();
    this.renderer.destroy();
  }
}

import { WebDemuxer } from 'web-demuxer';
import type { ExportSegment } from '@screen-recorder/types/export';

/**
 * Ported from a reference implementation's `streamingDecoder.ts` (battle-tested
 * VFR->CFR resampling, codec-string normalization, container-duration validation).
 * Simplified for this app's data model: `ExportSegment[]` already represents
 * pre-split *kept* ranges with their own per-segment speed, so the reference's
 * separate trim-region-to-keep-segment conversion and speed-region-splitting pass
 * are unnecessary here -- segments are used directly.
 *
 * No ffmpeg subprocess anywhere: `web-demuxer` (WASM) demuxes the container,
 * native WebCodecs `VideoDecoder` decodes, hardware-accelerated by Chromium.
 */

const SOURCE_LOAD_TIMEOUT_MS = 60_000;
const EPSILON_SEC = 0.001;

/** Builds a full WebCodecs-compatible AV1 codec string from the AV1CodecConfigurationRecord. web-demuxer can return a bare "av01" when the WASM parser fails to read the extradata. */
function buildAV1CodecString(description?: BufferSource): string {
  const fallback = 'av01.0.01M.08';
  if (!description) return fallback;

  const bytes =
    description instanceof ArrayBuffer
      ? new Uint8Array(description)
      : new Uint8Array(description.buffer, description.byteOffset, description.byteLength);

  if (bytes.length < 4) return fallback;
  if (!(bytes[0] & 0x80)) return fallback; // marker bit must be 1

  const profile = (bytes[1] >> 5) & 0x07;
  const level = bytes[1] & 0x1f;
  const tier = (bytes[2] >> 7) & 0x01;
  const highBitdepth = (bytes[2] >> 6) & 0x01;
  const twelveBit = (bytes[2] >> 5) & 0x01;
  const bitdepth = highBitdepth ? (twelveBit ? 12 : 10) : 8;

  const tierChar = tier ? 'H' : 'M';
  const levelStr = level.toString().padStart(2, '0');
  const bitdepthStr = bitdepth.toString().padStart(2, '0');
  return `av01.${profile}.${levelStr}${tierChar}.${bitdepthStr}`;
}

export interface DecodedVideoInfo {
  width: number;
  height: number;
  duration: number; // seconds
  streamDuration?: number; // seconds
  frameRate: number;
  codec: string;
  hasAudio: boolean;
  audioCodec?: string;
}

const EARLY_DECODE_END_THRESHOLD_SEC = 1;
const METADATA_TAIL_TOLERANCE_SEC = 2;
const STREAM_DURATION_MATCH_TOLERANCE_SEC = 0.25;
const DURATION_DIVERGENCE_THRESHOLD_SEC = 1.5;
const SCAN_UNBOUNDED_FALLBACK_SEC = 24 * 60 * 60;

/** Chrome/Electron MediaRecorder writes WebM with unreliable Duration fields (often Infinity, 0, or inflated). Packet timestamps are ground truth when they diverge from the container's claim. */
export function validateDuration(containerDuration: number, scannedDuration: number): number {
  if (scannedDuration <= 0) {
    return Number.isFinite(containerDuration) ? Math.max(containerDuration, 0) : 0;
  }
  if (!Number.isFinite(containerDuration) || containerDuration <= 0) {
    return scannedDuration;
  }
  if (Math.abs(containerDuration - scannedDuration) > DURATION_DIVERGENCE_THRESHOLD_SEC) {
    return scannedDuration;
  }
  return containerDuration;
}

interface EarlyDecodeEndCheck {
  cancelled: boolean;
  lastDecodedFrameSec: number | null;
  requiredEndSec: number;
  streamDurationSec?: number;
}

export function shouldFailDecodeEndedEarly({
  cancelled,
  lastDecodedFrameSec,
  requiredEndSec,
  streamDurationSec
}: EarlyDecodeEndCheck): boolean {
  if (cancelled || requiredEndSec <= 0) return false;
  if (lastDecodedFrameSec === null) return true;

  const decodeGapSec = requiredEndSec - lastDecodedFrameSec;
  if (decodeGapSec <= EARLY_DECODE_END_THRESHOLD_SEC) return false;

  if (typeof streamDurationSec !== 'number' || !Number.isFinite(streamDurationSec)) return true;

  const metadataTailSec = requiredEndSec - streamDurationSec;
  const decodedNearStreamEnd =
    Math.abs(lastDecodedFrameSec - streamDurationSec) <= STREAM_DURATION_MATCH_TOLERANCE_SEC;
  const maxTailSec = Math.max(METADATA_TAIL_TOLERANCE_SEC, requiredEndSec * 0.01);
  if (decodedNearStreamEnd && metadataTailSec > 0 && metadataTailSec <= maxTailSec) return false;

  return true;
}

/** Caller must close the VideoFrame after use. */
type OnFrameCallback = (
  frame: VideoFrame,
  exportTimestampUs: number,
  sourceTimestampMs: number,
  segment: ExportSegment
) => Promise<void>;

interface Segment {
  startSec: number;
  endSec: number;
  speed: number;
  source: ExportSegment;
}

/**
 * Decodes video frames via web-demuxer + VideoDecoder in a single forward pass --
 * far faster than seeking an HTMLVideoElement per frame, and (unlike the previous
 * ffmpeg-subprocess pipeline) never leaves the browser process.
 *
 * Frames outside kept segments are still decoded (needed for P/B-frame state) but
 * discarded. Kept frames are resampled to the target frame rate in the same
 * streaming pass via held-frame cloning (no seeking).
 */
export class StreamingVideoDecoder {
  private demuxer: WebDemuxer | null = null;
  private decoder: VideoDecoder | null = null;
  private cancelled = false;
  private metadata: DecodedVideoInfo | null = null;

  /** `wasmUrl` must be a fully-qualified URL -- see `wasm-path.ts` for why. */
  constructor(private readonly wasmUrl: string) {}

  async loadMetadata(file: File): Promise<DecodedVideoInfo> {
    this.demuxer = new WebDemuxer({ wasmFilePath: this.wasmUrl });
    await this.withTimeout(
      this.demuxer.load(file),
      SOURCE_LOAD_TIMEOUT_MS,
      'Timed out while parsing the source video.'
    );

    const mediaInfo = await this.withTimeout(
      this.demuxer.getMediaInfo(),
      SOURCE_LOAD_TIMEOUT_MS,
      'Timed out while reading video metadata.'
    );
    const videoStream = mediaInfo.streams.find((s) => s.codec_type_string === 'video');

    let frameRate = 60;
    if (videoStream?.avg_frame_rate) {
      const parts = videoStream.avg_frame_rate.split('/');
      if (parts.length === 2) {
        const num = parseInt(parts[0], 10);
        const den = parseInt(parts[1], 10);
        if (den > 0 && num > 0) frameRate = num / den;
      }
    }

    const audioStream = mediaInfo.streams.find((s) => s.codec_type_string === 'audio');

    const containerDurationSec = Number.isFinite(mediaInfo.duration) ? mediaInfo.duration : 0;
    const streamDurationSec =
      typeof videoStream?.duration === 'number' && Number.isFinite(videoStream.duration)
        ? videoStream.duration
        : 0;
    const hintedDurationSec = Math.max(containerDurationSec, streamDurationSec, 0);
    const scanEndSec =
      hintedDurationSec > 0 ? hintedDurationSec + 0.5 : SCAN_UNBOUNDED_FALLBACK_SEC;
    let maxPacketEndUs = 0;
    const scanReader = this.demuxer.read('video', 0, scanEndSec).getReader();
    try {
      while (true) {
        // Each individual read(), not just the loop as a whole, is guarded --
        // a container the WASM demuxer can't fully walk (e.g. a WebM missing
        // Cues, which is exactly when the caller above falls into the
        // unbounded 24h `scanEndSec` fallback) can stall on a single read()
        // forever with no error, otherwise.
        const { done, value } = await this.withTimeout(
          scanReader.read(),
          SOURCE_LOAD_TIMEOUT_MS,
          'Timed out while scanning the source video for its real duration.'
        );
        if (done || !value) break;
        const endUs = value.timestamp + (value.duration ?? 0);
        if (endUs > maxPacketEndUs) maxPacketEndUs = endUs;
      }
    } finally {
      try {
        await scanReader.cancel();
      } catch {
        /* already closed */
      }
    }
    const scannedDuration = maxPacketEndUs / 1_000_000;
    const validatedDuration = validateDuration(mediaInfo.duration, scannedDuration);

    this.metadata = {
      width: videoStream?.width || 1920,
      height: videoStream?.height || 1080,
      duration: validatedDuration,
      streamDuration:
        typeof videoStream?.duration === 'number' && Number.isFinite(videoStream.duration)
          ? videoStream.duration
          : undefined,
      frameRate,
      codec: videoStream?.codec_string || 'unknown',
      hasAudio: !!audioStream,
      audioCodec: audioStream?.codec_string
    };

    return this.metadata;
  }

  /**
   * Decodes all video frames for the given kept segments, resampled to the
   * target frame rate.
   */
  async decodeAll(
    targetFrameRate: number,
    segments: ExportSegment[],
    onFrame: OnFrameCallback,
    onWarning?: (message: string) => void
  ): Promise<void> {
    if (!this.demuxer || !this.metadata) {
      throw new Error('Must call loadMetadata() before decodeAll()');
    }

    const decoderConfig = await this.demuxer.getDecoderConfig('video');

    // web-demuxer can return bare fourcc strings ("av01", "vp08", "vp09", "avc1")
    // that WebCodecs rejects; normalize to forms VideoDecoder accepts.
    if (/^av01$/i.test(decoderConfig.codec)) {
      decoderConfig.codec = buildAV1CodecString(
        decoderConfig.description as BufferSource | undefined
      );
    }
    if (/^vp08$/i.test(decoderConfig.codec)) decoderConfig.codec = 'vp8';
    if (/^vp09$/i.test(decoderConfig.codec)) decoderConfig.codec = 'vp9';
    if (/^avc1$/i.test(decoderConfig.codec)) decoderConfig.codec = 'avc1.640033';
    if (/^h264$/i.test(decoderConfig.codec)) decoderConfig.codec = 'avc1.640033';

    const codec = decoderConfig.codec.toLowerCase();
    const shouldPreferSoftwareDecode =
      codec.includes('av01') ||
      codec.includes('av1') ||
      codec.includes('vp09') ||
      codec.includes('vp9');

    const orderedSegments: Segment[] = segments.map((segment) => ({
      startSec: segment.range.startMs / 1000,
      endSec: segment.range.endMs / 1000,
      speed: segment.speed,
      source: segment
    }));
    const requiredEndSec = orderedSegments[orderedSegments.length - 1]?.endSec ?? 0;

    const segmentOutputFrameCounts = orderedSegments.map((segment) =>
      Math.ceil(
        ((segment.endSec - segment.startSec - EPSILON_SEC) / segment.speed) * targetFrameRate
      )
    );
    const frameDurationUs = 1_000_000 / targetFrameRate;

    const pendingFrames: VideoFrame[] = [];
    let frameResolve: ((frame: VideoFrame | null) => void) | null = null;
    let decodeError: Error | null = null;
    let decodeDone = false;

    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        if (frameResolve) {
          const resolve = frameResolve;
          frameResolve = null;
          resolve(frame);
        } else {
          pendingFrames.push(frame);
        }
      },
      error: (e: DOMException) => {
        console.warn(
          `[StreamingVideoDecoder] decoder error for codec "${decoderConfig.codec}":`,
          e.message
        );
        decodeError = new Error(`VideoDecoder error: ${e.message}`);
        if (frameResolve) {
          const resolve = frameResolve;
          frameResolve = null;
          resolve(null);
        }
      }
    });

    const preferredDecoderConfig = shouldPreferSoftwareDecode
      ? { ...decoderConfig, hardwareAcceleration: 'prefer-software' as const }
      : decoderConfig;

    try {
      const support = await VideoDecoder.isConfigSupported(preferredDecoderConfig);
      if (!support.supported) {
        throw new Error(`Unsupported codec: ${preferredDecoderConfig.codec}`);
      }
      this.decoder.configure(preferredDecoderConfig);
    } catch (error) {
      if (shouldPreferSoftwareDecode) {
        this.decoder.configure(decoderConfig);
      } else if (/^avc1/i.test(codec)) {
        const fallback = { ...decoderConfig, codec: 'avc1.640033' };
        console.warn(
          `[StreamingVideoDecoder] codec "${codec}" unsupported, falling back to "${fallback.codec}"`
        );
        this.decoder.configure(fallback);
      } else {
        throw error;
      }
    }

    const getNextFrame = (): Promise<VideoFrame | null> => {
      if (decodeError) throw decodeError;
      if (pendingFrames.length > 0) return Promise.resolve(pendingFrames.shift()!);
      if (decodeDone) return Promise.resolve(null);
      return new Promise((resolve) => {
        frameResolve = resolve;
      });
    };

    const readEndSec = this.metadata.duration + 0.5;
    const reader = this.demuxer.read('video', 0, readEndSec).getReader();

    const feedPromise = (async () => {
      try {
        while (!this.cancelled) {
          // Same per-read stall guard as loadMetadata's duration scan --
          // without it, a demuxer read that never resolves hangs the whole
          // export at 0% with no error instead of failing fast.
          const { done, value: chunk } = await this.withTimeout(
            reader.read(),
            SOURCE_LOAD_TIMEOUT_MS,
            'Timed out while reading the source video.'
          );
          if (done || !chunk) break;

          while (
            (this.decoder!.decodeQueueSize > 10 || pendingFrames.length > 24) &&
            !this.cancelled
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
          if (this.cancelled) break;

          this.decoder!.decode(chunk);
        }
        if (!this.cancelled && this.decoder!.state === 'configured') {
          await this.decoder!.flush();
        }
      } catch (e) {
        decodeError = e instanceof Error ? e : new Error(String(e));
      } finally {
        decodeDone = true;
        if (frameResolve) {
          const resolve = frameResolve;
          frameResolve = null;
          resolve(null);
        }
      }
    })();

    let segmentIdx = 0;
    let segmentFrameIndex = 0;
    let exportFrameIndex = 0;
    let lastDecodedFrameSec: number | null = null;
    let heldFrame: VideoFrame | null = null;
    let heldFrameSec = 0;

    const emitHeldFrameForTarget = async (segment: Segment): Promise<boolean> => {
      if (!heldFrame) return false;
      const segmentFrameCount = segmentOutputFrameCounts[segmentIdx];
      if (segmentFrameIndex >= segmentFrameCount) return false;

      const sourceTimeSec =
        segment.startSec + (segmentFrameIndex / targetFrameRate) * segment.speed;
      if (sourceTimeSec >= segment.endSec - EPSILON_SEC) return false;

      const clone = new VideoFrame(heldFrame, { timestamp: heldFrame.timestamp });
      await onFrame(
        clone,
        exportFrameIndex * frameDurationUs,
        sourceTimeSec * 1000,
        segment.source
      );
      segmentFrameIndex++;
      exportFrameIndex++;
      return true;
    };

    while (!this.cancelled && segmentIdx < orderedSegments.length) {
      const frame = await getNextFrame();
      if (!frame) break;

      const frameTimeSec = frame.timestamp / 1_000_000;
      lastDecodedFrameSec = frameTimeSec;

      while (
        segmentIdx < orderedSegments.length &&
        frameTimeSec >= orderedSegments[segmentIdx].endSec - EPSILON_SEC
      ) {
        const segment = orderedSegments[segmentIdx];
        while (!this.cancelled && (await emitHeldFrameForTarget(segment))) {
          // keep emitting remaining output frames for this segment
        }
        segmentIdx++;
        segmentFrameIndex = 0;
        if (
          heldFrame &&
          segmentIdx < orderedSegments.length &&
          heldFrameSec < orderedSegments[segmentIdx].startSec - EPSILON_SEC
        ) {
          heldFrame.close();
          heldFrame = null;
        }
      }

      if (segmentIdx >= orderedSegments.length) {
        frame.close();
        continue;
      }

      const currentSegment = orderedSegments[segmentIdx];

      if (frameTimeSec < currentSegment.startSec - EPSILON_SEC) {
        frame.close();
        continue;
      }

      if (!heldFrame) {
        heldFrame = frame;
        heldFrameSec = frameTimeSec;
        continue;
      }

      const handoffBoundarySec = (heldFrameSec + frameTimeSec) / 2;
      while (!this.cancelled) {
        const segmentFrameCount = segmentOutputFrameCounts[segmentIdx];
        if (segmentFrameIndex >= segmentFrameCount) break;

        const sourceTimeSec =
          currentSegment.startSec + (segmentFrameIndex / targetFrameRate) * currentSegment.speed;
        if (sourceTimeSec >= currentSegment.endSec - EPSILON_SEC) break;
        if (sourceTimeSec > handoffBoundarySec) break;

        const clone = new VideoFrame(heldFrame, { timestamp: heldFrame.timestamp });
        await onFrame(
          clone,
          exportFrameIndex * frameDurationUs,
          sourceTimeSec * 1000,
          currentSegment.source
        );
        segmentFrameIndex++;
        exportFrameIndex++;
      }

      heldFrame.close();
      heldFrame = frame;
      heldFrameSec = frameTimeSec;
    }

    if (heldFrame && segmentIdx < orderedSegments.length) {
      while (!this.cancelled && segmentIdx < orderedSegments.length) {
        const segment = orderedSegments[segmentIdx];
        if (heldFrameSec < segment.startSec - EPSILON_SEC) break;

        while (!this.cancelled && (await emitHeldFrameForTarget(segment))) {
          // keep emitting
        }
        segmentIdx++;
        segmentFrameIndex = 0;
        if (
          segmentIdx < orderedSegments.length &&
          heldFrameSec < orderedSegments[segmentIdx].startSec - EPSILON_SEC
        ) {
          break;
        }
      }
      heldFrame.close();
      heldFrame = null;
    }

    while (!decodeDone) {
      const frame = await getNextFrame();
      if (!frame) break;
      frame.close();
    }

    try {
      reader.cancel();
    } catch {
      /* already closed */
    }
    await feedPromise;
    for (const f of pendingFrames) f.close();
    pendingFrames.length = 0;

    // `feedPromise` never rejects -- it catches its own errors into
    // `decodeError` (see above) -- and a `frameResolve(null)` fired from
    // that same catch/finally resolves whatever the main loop above was
    // awaiting with `null`, identical to a clean end-of-stream. Both loops
    // can therefore exit via `if (!frame) break` without ever calling
    // `getNextFrame()` again to hit its own `if (decodeError) throw`
    // check, silently truncating the export instead of failing it. This is
    // the one place guaranteed to run after both loops are done, regardless
    // of which one observed the `null`.
    if (decodeError) throw decodeError;

    if (this.decoder?.state === 'configured') this.decoder.close();
    this.decoder = null;

    if (
      shouldFailDecodeEndedEarly({
        cancelled: this.cancelled,
        lastDecodedFrameSec,
        requiredEndSec,
        streamDurationSec: this.metadata.streamDuration
      })
    ) {
      const decodedAtLabel =
        lastDecodedFrameSec === null ? 'no decoded frame' : `${lastDecodedFrameSec.toFixed(3)}s`;
      const message = `Decode ended early at ${decodedAtLabel} (needed ${requiredEndSec.toFixed(3)}s) -- export may be slightly shorter than expected.`;
      console.warn(`[StreamingVideoDecoder] ${message}`);
      onWarning?.(message);
    }
  }

  /** Total output frame count for the given segments at the target frame rate. Requires loadMetadata() first. */
  getExportMetrics(targetFrameRate: number, segments: ExportSegment[]): { totalFrames: number } {
    if (!this.metadata) throw new Error('Must call loadMetadata() first');
    return {
      totalFrames: segments.reduce((sum, s) => {
        const segDur = (s.range.endMs - s.range.startMs) / 1000 - EPSILON_SEC;
        return sum + Math.max(0, Math.ceil((segDur / s.speed) * targetFrameRate));
      }, 0)
    };
  }

  getDemuxer(): WebDemuxer | null {
    return this.demuxer;
  }

  cancel(): void {
    this.cancelled = true;
  }

  destroy(): void {
    this.cancelled = true;
    if (this.decoder) {
      try {
        if (this.decoder.state === 'configured') this.decoder.close();
      } catch {
        /* ignore */
      }
      this.decoder = null;
    }
    if (this.demuxer) {
      try {
        this.demuxer.destroy();
      } catch {
        /* ignore */
      }
      this.demuxer = null;
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      );
    });
  }
}

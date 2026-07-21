import { WebDemuxer } from 'web-demuxer';
import type { ExportSegment } from '@screen-recorder/types/export';
import type { ExportAudioMuxerCodec, VideoMuxer } from './muxer';

/**
 * Adapted from a reference implementation's `audioEncoder.ts`. That version
 * processes one linear timeline of trim/speed *regions* -- this app's
 * `ExportSegment[]` already represents pre-split, independently orderable
 * kept clips (supporting "cut the middle out" / "reorder clips", which a
 * single forward decode pass can't express), so audio here is processed
 * **per segment, in output order** instead: each segment's own time range is
 * decoded/captured and re-encoded with continuously-advancing output
 * timestamps, then concatenated. This is a genuine redesign of the
 * reference's approach, not a straight port, though the core WebCodecs
 * encode/decode mechanics and the pitch-preserving capture technique for
 * speed != 1 segments are carried over closely.
 */

const AUDIO_BITRATE = 128_000;
const DECODE_BACKPRESSURE_LIMIT = 20;
const SEEK_TIMEOUT_MS = 5_000;

export interface ExportAudioCodec {
  encoderCodec: string;
  muxerCodec: ExportAudioMuxerCodec;
  label: string;
  sampleRate: number;
  numberOfChannels: number;
}

type ExportAudioCodecCandidate = Omit<ExportAudioCodec, 'sampleRate' | 'numberOfChannels'>;

const EXPORT_AUDIO_CODECS: ExportAudioCodecCandidate[] = [
  { encoderCodec: 'mp4a.40.2', muxerCodec: 'aac', label: 'AAC' },
  { encoderCodec: 'opus', muxerCodec: 'opus', label: 'Opus' }
];

export class AudioProcessor {
  private cancelled = false;

  static async selectSupportedExportCodec(
    sampleRate: number,
    numberOfChannels: number
  ): Promise<ExportAudioCodec | null> {
    const channelOptions = [numberOfChannels];
    if (numberOfChannels > 2) channelOptions.push(2);
    if (!channelOptions.includes(1)) channelOptions.push(1);

    for (const codec of EXPORT_AUDIO_CODECS) {
      for (const channels of channelOptions) {
        const support = await AudioEncoder.isConfigSupported({
          codec: codec.encoderCodec,
          sampleRate,
          numberOfChannels: channels,
          bitrate: AUDIO_BITRATE
        });
        if (support.supported) return { ...codec, sampleRate, numberOfChannels: channels };
      }
    }
    return null;
  }

  static async selectSupportedExportCodecForSource(
    demuxer: WebDemuxer
  ): Promise<ExportAudioCodec | null> {
    let audioConfig: AudioDecoderConfig;
    try {
      audioConfig = await demuxer.getDecoderConfig('audio');
    } catch {
      return null;
    }
    const codecCheck = await AudioDecoder.isConfigSupported(audioConfig);
    if (!codecCheck.supported) return null;
    return AudioProcessor.selectSupportedExportCodec(
      audioConfig.sampleRate || 48000,
      audioConfig.numberOfChannels || 2
    );
  }

  /**
   * Processes every segment's audio, in output order, into `muxer`.
   * `sourceUrl` is only needed for speed != 1 segments (the pitch-preserving
   * capture path needs a real, playable media URL).
   *
   * Only one `WebDemuxer` (each spawns its own WASM Worker) is ever kept
   * alive at a time: `processSpeedChangedSegment` opens a second, short-lived
   * `WebDemuxer` internally to demux its MediaRecorder capture, and running
   * that concurrently with a still-open source demuxer causes the second
   * instance's worker messages (e.g. `getDecoderConfig`) to never resolve --
   * observed as an indefinite hang, not an error. The source demuxer is
   * therefore destroyed before every speed-changed segment and lazily
   * recreated for the next trim-only one.
   */
  async process(
    sourceFile: File,
    muxer: VideoMuxer,
    sourceUrl: string,
    segments: ExportSegment[],
    exportCodec: ExportAudioCodec,
    wasmUrl: string
  ): Promise<void> {
    let outputTimestampUs = 0;
    let sourceDemuxer: WebDemuxer | null = null;
    try {
      for (const segment of segments) {
        if (this.cancelled) return;
        if (segment.speed === 1) {
          if (!sourceDemuxer) {
            sourceDemuxer = new WebDemuxer({ wasmFilePath: wasmUrl });
            await sourceDemuxer.load(sourceFile);
          }
          outputTimestampUs = await this.processTrimOnlySegment(
            sourceDemuxer,
            muxer,
            segment,
            exportCodec,
            outputTimestampUs
          );
        } else {
          if (sourceDemuxer) {
            sourceDemuxer.destroy();
            sourceDemuxer = null;
          }
          outputTimestampUs = await this.processSpeedChangedSegment(
            sourceUrl,
            muxer,
            segment,
            exportCodec,
            outputTimestampUs,
            wasmUrl
          );
        }
      }
    } finally {
      sourceDemuxer?.destroy();
    }
  }

  /** Fast path: demux/decode/re-encode this segment's own time range directly, no real-time playback. */
  private async processTrimOnlySegment(
    demuxer: WebDemuxer,
    muxer: VideoMuxer,
    segment: ExportSegment,
    exportCodec: ExportAudioCodec,
    startTimestampUs: number
  ): Promise<number> {
    let audioConfig: AudioDecoderConfig;
    try {
      audioConfig = await demuxer.getDecoderConfig('audio');
    } catch {
      return startTimestampUs;
    }

    const decodedFrames: AudioData[] = [];
    const decoder = new AudioDecoder({
      output: (data) => decodedFrames.push(data),
      error: (e) => console.error('[AudioProcessor] Decode error:', e)
    });
    decoder.configure(audioConfig);

    const startSec = segment.range.startMs / 1000;
    const endSec = segment.range.endMs / 1000;
    const reader = demuxer.read('audio', startSec, endSec).getReader();
    try {
      while (!this.cancelled) {
        const { done, value: chunk } = await reader.read();
        if (done || !chunk) break;
        decoder.decode(chunk);
        while (decoder.decodeQueueSize > DECODE_BACKPRESSURE_LIMIT && !this.cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        /* already closed */
      }
    }
    if (decoder.state === 'configured') {
      await decoder.flush();
      decoder.close();
    }

    if (this.cancelled || decodedFrames.length === 0) {
      for (const frame of decodedFrames) frame.close();
      return startTimestampUs;
    }

    return this.reencodeAndMux(decodedFrames, muxer, exportCodec, startSec, startTimestampUs);
  }

  /**
   * Pitch-preserving path for a speed != 1 segment: plays this segment's
   * source time range through a real `<audio>` element at `segment.speed`
   * (`preservesPitch: true`), captures it via `MediaRecorder`, then demuxes
   * and re-encodes the capture. Needs real DOM (`HTMLMediaElement`
   * playback, `requestAnimationFrame`) -- must run on the main thread, not
   * inside a Worker.
   */
  private async processSpeedChangedSegment(
    sourceUrl: string,
    muxer: VideoMuxer,
    segment: ExportSegment,
    exportCodec: ExportAudioCodec,
    startTimestampUs: number,
    wasmUrl: string
  ): Promise<number> {
    const recordedBlob = await this.capturePitchPreservedSegment(sourceUrl, segment);
    if (this.cancelled || recordedBlob.size === 0) return startTimestampUs;
    // Constructing a new `WebDemuxer` (spawns its own WASM Worker) right on
    // the heels of `capturePitchPreservedSegment`'s AudioContext/MediaRecorder
    // teardown races with that teardown's own async cleanup on rare occasions
    // -- observed as `demuxer.load()` hanging indefinitely with no error, not
    // as a flaky failure. A macrotask yield here reliably avoids it.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const file = new File([recordedBlob], 'speed-audio.webm', {
      type: recordedBlob.type || 'audio/webm'
    });
    const demuxer = new WebDemuxer({ wasmFilePath: wasmUrl });
    try {
      await demuxer.load(file);
      const capturedDurationSec = recordedBlob.size > 0 ? await this.probeDuration(demuxer) : 0;
      const result = await this.processTrimOnlySegment(
        demuxer,
        muxer,
        {
          range: { startMs: 0, endMs: capturedDurationSec * 1000 },
          crop: null,
          speed: 1
        },
        exportCodec,
        startTimestampUs
      );
      return result;
    } finally {
      try {
        demuxer.destroy();
      } catch {
        /* ignore */
      }
    }
  }

  private async probeDuration(demuxer: WebDemuxer): Promise<number> {
    const info = await demuxer.getMediaInfo();
    return Number.isFinite(info.duration) ? info.duration : 0;
  }

  private capturePitchPreservedSegment(sourceUrl: string, segment: ExportSegment): Promise<Blob> {
    return new Promise((resolve, reject) => {
      void this.runCapture(sourceUrl, segment).then(resolve, reject);
    });
  }

  private async runCapture(sourceUrl: string, segment: ExportSegment): Promise<Blob> {
    const media = document.createElement('audio');
    media.src = sourceUrl;
    media.preload = 'auto';

    const pitchMedia = media as HTMLMediaElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    pitchMedia.preservesPitch = true;
    pitchMedia.mozPreservesPitch = true;
    pitchMedia.webkitPreservesPitch = true;

    await this.waitForLoadedMetadata(media);
    if (this.cancelled) throw new Error('Export cancelled');

    const audioContext = new AudioContext();
    const sourceNode = audioContext.createMediaElementSource(media);
    const destinationNode = audioContext.createMediaStreamDestination();
    sourceNode.connect(destinationNode);

    let rafId: number | null = null;
    let recorder: MediaRecorder | null = null;
    let recordedBlobPromise: Promise<Blob> | null = null;

    const startSec = segment.range.startMs / 1000;
    const endSec = segment.range.endMs / 1000;

    try {
      if (audioContext.state === 'suspended') await audioContext.resume();
      await this.seekTo(media, startSec);
      media.playbackRate = segment.speed;

      const recording = this.startAudioRecording(destinationNode.stream);
      recorder = recording.recorder;
      recordedBlobPromise = recording.recordedBlobPromise;
      await media.play();

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          media.removeEventListener('error', onError);
          media.removeEventListener('ended', onEnded);
        };
        const onError = () => {
          cleanup();
          reject(new Error('Failed while rendering speed-adjusted audio'));
        };
        const onEnded = () => {
          cleanup();
          resolve();
        };
        const tick = (): void => {
          if (this.cancelled) {
            cleanup();
            resolve();
            return;
          }
          if (media.currentTime >= endSec) {
            media.pause();
            cleanup();
            resolve();
            return;
          }
          if (!media.paused && !media.ended) {
            rafId = requestAnimationFrame(tick);
          } else {
            cleanup();
            resolve();
          }
        };
        media.addEventListener('error', onError, { once: true });
        media.addEventListener('ended', onEnded, { once: true });
        rafId = requestAnimationFrame(tick);
      });

      // Stop the recorder and wait for it to actually flush its final chunk
      // (`onstop`) *before* stopping the underlying MediaStreamTrack below --
      // stopping the track first can cut the recorder's pipeline off before
      // it finishes, so `onstop`/the last `ondataavailable` never fire and
      // this hangs forever instead of erroring.
      if (recorder.state !== 'inactive') recorder.stop();
      return await recordedBlobPromise;
    } finally {
      if (rafId !== null) cancelAnimationFrame(rafId);
      media.pause();
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      destinationNode.stream.getTracks().forEach((track) => track.stop());
      sourceNode.disconnect();
      destinationNode.disconnect();
      await audioContext.close();
      media.src = '';
      media.load();
    }
  }

  private startAudioRecording(stream: MediaStream): {
    recorder: MediaRecorder;
    recordedBlobPromise: Promise<Blob>;
  } {
    const mimeType = this.getSupportedAudioMimeType();
    const options: MediaRecorderOptions = {
      audioBitsPerSecond: AUDIO_BITRATE,
      ...(mimeType ? { mimeType } : {})
    };
    const recorder = new MediaRecorder(stream, options);
    const chunks: Blob[] = [];
    const recordedBlobPromise = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () =>
        reject(new Error('MediaRecorder failed while capturing speed-adjusted audio'));
      recorder.onstop = () =>
        resolve(new Blob(chunks, { type: mimeType || chunks[0]?.type || 'audio/webm' }));
    });
    recorder.start();
    return { recorder, recordedBlobPromise };
  }

  private getSupportedAudioMimeType(): string | undefined {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm'];
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    }
    return undefined;
  }

  private waitForLoadedMetadata(media: HTMLMediaElement): Promise<void> {
    if (Number.isFinite(media.duration) && media.readyState >= HTMLMediaElement.HAVE_METADATA) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Failed to load media metadata for speed-adjusted audio'));
      };
      const cleanup = () => {
        media.removeEventListener('loadedmetadata', onLoaded);
        media.removeEventListener('error', onError);
      };
      media.addEventListener('loadedmetadata', onLoaded);
      media.addEventListener('error', onError, { once: true });
    });
  }

  private seekTo(media: HTMLMediaElement, targetSec: number): Promise<void> {
    if (Math.abs(media.currentTime - targetSec) < 0.0001) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Failed to seek media for speed-adjusted audio'));
      };
      const cleanup = () => {
        media.removeEventListener('seeked', onSeeked);
        media.removeEventListener('error', onError);
        clearTimeout(timer);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Audio seek timed out'));
      }, SEEK_TIMEOUT_MS);
      media.addEventListener('seeked', onSeeked, { once: true });
      media.addEventListener('error', onError, { once: true });
      media.currentTime = targetSec;
    });
  }

  private async reencodeAndMux(
    decodedFrames: AudioData[],
    muxer: VideoMuxer,
    exportCodec: ExportAudioCodec,
    segmentStartSec: number,
    startTimestampUs: number
  ): Promise<number> {
    const encodedChunks: { chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }[] = [];
    const encoder = new AudioEncoder({
      output: (chunk, meta) => encodedChunks.push({ chunk, meta }),
      error: (e) => console.error('[AudioProcessor] Encode error:', e)
    });

    const encodeConfig: AudioEncoderConfig = {
      codec: exportCodec.encoderCodec,
      sampleRate: exportCodec.sampleRate,
      numberOfChannels: exportCodec.numberOfChannels,
      bitrate: AUDIO_BITRATE
    };
    const support = await AudioEncoder.isConfigSupported(encodeConfig);
    if (!support.supported) {
      for (const frame of decodedFrames) frame.close();
      console.warn(`[AudioProcessor] ${exportCodec.label} encoding not supported, skipping audio`);
      return startTimestampUs;
    }
    encoder.configure(encodeConfig);

    let maxOutputTimestampUs = startTimestampUs;
    for (const audioData of decodedFrames) {
      if (this.cancelled) {
        audioData.close();
        continue;
      }
      const relativeUs = audioData.timestamp - segmentStartSec * 1_000_000;
      const outputTimestampUs = Math.max(0, startTimestampUs + relativeUs);
      const adjusted = this.cloneWithTimestamp(
        audioData,
        outputTimestampUs,
        exportCodec.numberOfChannels
      );
      audioData.close();
      encoder.encode(adjusted);
      const frameEndUs = outputTimestampUs + (adjusted.duration ?? 0);
      if (frameEndUs > maxOutputTimestampUs) maxOutputTimestampUs = frameEndUs;
      adjusted.close();
    }

    if (encoder.state === 'configured') {
      await encoder.flush();
      encoder.close();
    }

    for (const { chunk, meta } of encodedChunks) {
      if (this.cancelled) break;
      await muxer.addAudioChunk(chunk, meta);
    }

    return maxOutputTimestampUs;
  }

  private cloneWithTimestamp(
    src: AudioData,
    newTimestamp: number,
    targetChannels: number
  ): AudioData {
    if (targetChannels !== src.numberOfChannels) {
      return this.downmixWithTimestamp(src, newTimestamp, targetChannels);
    }
    if (!src.format) throw new Error('AudioData format is required for cloning');
    const isPlanar = src.format.includes('planar');
    const numPlanes = isPlanar ? src.numberOfChannels : 1;

    let totalSize = 0;
    for (let planeIndex = 0; planeIndex < numPlanes; planeIndex++) {
      totalSize += src.allocationSize({ planeIndex });
    }
    const buffer = new ArrayBuffer(totalSize);
    let offset = 0;
    for (let planeIndex = 0; planeIndex < numPlanes; planeIndex++) {
      const planeSize = src.allocationSize({ planeIndex });
      src.copyTo(new Uint8Array(buffer, offset, planeSize), { planeIndex });
      offset += planeSize;
    }
    return new AudioData({
      format: src.format,
      sampleRate: src.sampleRate,
      numberOfFrames: src.numberOfFrames,
      numberOfChannels: src.numberOfChannels,
      timestamp: newTimestamp,
      data: buffer
    });
  }

  private downmixWithTimestamp(
    src: AudioData,
    newTimestamp: number,
    targetChannels: number
  ): AudioData {
    const sourceChannels = src.numberOfChannels;
    const frameCount = src.numberOfFrames;
    if (targetChannels < 1 || targetChannels > 2) {
      throw new Error(`Unsupported target channel count: ${targetChannels}`);
    }
    const sourcePlanes = Array.from({ length: sourceChannels }, () => new Float32Array(frameCount));
    for (let channel = 0; channel < sourceChannels; channel++) {
      src.copyTo(sourcePlanes[channel], { format: 'f32-planar', planeIndex: channel });
    }
    const output = downmixPlanarChannels(sourcePlanes, targetChannels);
    return new AudioData({
      format: 'f32-planar',
      sampleRate: src.sampleRate,
      numberOfFrames: frameCount,
      numberOfChannels: targetChannels,
      timestamp: newTimestamp,
      data: output.buffer instanceof ArrayBuffer ? output.buffer : output.slice().buffer
    });
  }

  cancel(): void {
    this.cancelled = true;
  }
}

function averageChannels(sourcePlanes: Float32Array[], frame: number): number {
  let mixed = 0;
  for (const plane of sourcePlanes) mixed += plane[frame] ?? 0;
  return mixed / Math.max(1, sourcePlanes.length);
}

/** Mono/stereo downmix -- ported verbatim from the reference (correct multi-channel-order weighting is fiddly to get right and not worth re-deriving). */
export function downmixPlanarChannels(
  sourcePlanes: Float32Array[],
  targetChannels: number
): Float32Array {
  const frameCount = sourcePlanes[0]?.length ?? 0;
  const output = new Float32Array(frameCount * targetChannels);

  if (targetChannels === 1) {
    for (let frame = 0; frame < frameCount; frame++)
      output[frame] = averageChannels(sourcePlanes, frame);
    return output;
  }
  if (targetChannels !== 2) throw new Error(`Unsupported target channel count: ${targetChannels}`);

  if (sourcePlanes.length === 1) {
    output.set(sourcePlanes[0], 0);
    output.set(sourcePlanes[0], frameCount);
    return output;
  }
  if (sourcePlanes.length === 2) {
    output.set(sourcePlanes[0], 0);
    output.set(sourcePlanes[1], frameCount);
    return output;
  }

  const centerWeight = Math.SQRT1_2;
  const surroundWeight = Math.SQRT1_2;
  const lfeWeight = 0.5;
  const weights =
    sourcePlanes.length >= 6
      ? {
          left: [
            [0, 1],
            [2, centerWeight],
            [3, lfeWeight],
            [4, surroundWeight]
          ] as Array<[number, number]>,
          right: [
            [1, 1],
            [2, centerWeight],
            [3, lfeWeight],
            [5, surroundWeight]
          ] as Array<[number, number]>
        }
      : {
          left: [
            [0, 1],
            [2, centerWeight]
          ] as Array<[number, number]>,
          right: [
            [1, 1],
            [2, centerWeight]
          ] as Array<[number, number]>
        };

  const weightedSample = (frame: number, w: Array<[number, number]>): number => {
    let mixed = 0;
    let weightSum = 0;
    for (const [channel, weight] of w) {
      const sample = sourcePlanes[channel]?.[frame];
      if (typeof sample !== 'number') continue;
      mixed += sample * weight;
      weightSum += weight;
    }
    return weightSum > 0 ? mixed / weightSum : averageChannels(sourcePlanes, frame);
  };

  for (let frame = 0; frame < frameCount; frame++) {
    output[frame] = weightedSample(frame, weights.left);
    output[frameCount + frame] = weightedSample(frame, weights.right);
  }
  return output;
}

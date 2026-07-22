import {
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedVideoPacketSource,
  MovOutputFormat,
  Mp4OutputFormat,
  WebMOutputFormat,
  type VideoCodec,
  Output
} from 'mediabunny';
import type { ExportFormat } from '@screen-recorder/types/export';

export type ExportAudioMuxerCodec = 'aac' | 'opus';

export interface MuxerConfig {
  format: Exclude<ExportFormat, 'gif'>;
  frameRate: number;
  videoCodec: VideoCodec;
}

/** Muxes WebCodecs `EncodedVideoChunk`/`EncodedAudioChunk`s into an in-memory container -- no filesystem access, no ffmpeg subprocess. */
export class VideoMuxer {
  private output: Output | null = null;
  private videoSource: EncodedVideoPacketSource | null = null;
  private audioSource: EncodedAudioPacketSource | null = null;
  private target: BufferTarget | null = null;

  constructor(
    private readonly config: MuxerConfig,
    private readonly hasAudio = false,
    private readonly audioCodec: ExportAudioMuxerCodec = 'aac'
  ) {}

  async initialize(): Promise<void> {
    this.target = new BufferTarget();
    this.output = new Output({
      format: this.createOutputFormat(),
      target: this.target
    });

    this.videoSource = new EncodedVideoPacketSource(this.config.videoCodec);
    this.output.addVideoTrack(this.videoSource, { frameRate: this.config.frameRate });

    if (this.hasAudio) {
      this.audioSource = new EncodedAudioPacketSource(this.audioCodec);
      this.output.addAudioTrack(this.audioSource);
    }

    await this.output.start();
  }

  async addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): Promise<void> {
    if (!this.videoSource) throw new Error('Muxer not initialized');
    const packet = EncodedPacket.fromEncodedChunk(chunk);
    await this.videoSource.add(packet, meta);
  }

  async addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): Promise<void> {
    if (!this.audioSource) throw new Error('Audio not configured for this muxer');
    const packet = EncodedPacket.fromEncodedChunk(chunk);
    await this.audioSource.add(packet, meta);
  }

  async finalize(): Promise<Blob> {
    if (!this.output || !this.target) throw new Error('Muxer not initialized');
    await this.output.finalize();
    const buffer = this.target.buffer;
    if (!buffer) throw new Error('Failed to finalize output');
    return new Blob([buffer], { type: this.mimeType() });
  }

  private createOutputFormat() {
    switch (this.config.format) {
      case 'mp4':
        return new Mp4OutputFormat({ fastStart: 'in-memory' });
      case 'mov':
        return new MovOutputFormat({ fastStart: 'in-memory' });
      case 'webm':
        return new WebMOutputFormat();
    }
  }

  private mimeType(): string {
    switch (this.config.format) {
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'webm':
        return 'video/webm';
    }
  }
}

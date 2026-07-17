import { PassThrough, type Writable } from 'stream';
import ffmpeg, { type FfmpegCommand } from 'fluent-ffmpeg';
import type { ExportCodec, ExportFormat } from '@screen-recorder/types/export';
import type { ClipSpeed, TimeRange } from '@screen-recorder/types/timeline';
import './ffmpeg-config';

let encoderNamesCache: Set<string> | null = null;

function getAvailableEncoderNames(): Promise<Set<string>> {
  if (encoderNamesCache) return Promise.resolve(encoderNamesCache);
  return new Promise((resolve, reject) => {
    ffmpeg.getAvailableEncoders((err, encoders) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      encoderNamesCache = new Set(Object.keys(encoders));
      resolve(encoderNamesCache);
    });
  });
}

const CODEC_TO_ENCODER: Record<ExportCodec, string> = {
  h264: 'libx264',
  h265: 'libx265',
  av1: 'libaom-av1'
};

/** WebM cannot legally hold H.264/H.265, so `format:'webm'` always forces VP9. */
export async function resolveVideoEncoder(
  format: ExportFormat,
  codec: ExportCodec
): Promise<string> {
  if (format === 'webm') {
    console.warn(`webm export always uses VP9; ignoring requested codec "${codec}"`);
    return 'libvpx-vp9';
  }

  const encoder = CODEC_TO_ENCODER[codec];
  const available = await getAvailableEncoderNames();
  if (!available.has(encoder)) {
    throw new Error(
      `${codec.toUpperCase()} encoding is not available in this build of ffmpeg. Choose H.264 or H.265.`
    );
  }
  return encoder;
}

function qualityToSettings(quality: number): { crf: number; preset: string } {
  if (quality <= 25) return { crf: 32, preset: 'veryfast' };
  if (quality <= 60) return { crf: 23, preset: 'medium' };
  if (quality <= 90) return { crf: 18, preset: 'slow' };
  return { crf: 0, preset: 'veryslow' };
}

interface AudioSegment {
  range: TimeRange;
  speed: ClipSpeed;
}

/**
 * Builds the `-filter_complex` chain that extracts each kept segment's audio
 * and concatenates them in order. A single ffmpeg input can only be seeked
 * to one range, but `atrim` operates on presentation timestamps and can be
 * applied to the *same* decoded input multiple times, so the whole audio
 * track is decoded once and carved up here instead of re-seeking per
 * segment. Each segment's own speed is applied via `atempo` (valid for
 * 0.5-2.0 in a single instance, which covers the full `ClipSpeed` range with
 * no chaining) so sped-up/slowed audio stays in sync with the video's own
 * `setpts` rescaling in video-decoder.ts. Returns the filter strings plus
 * the label to map in `-map`.
 */
function buildAudioConcatFilter(
  segments: AudioSegment[],
  audioInputIndex: number
): { filters: string[]; outLabel: string } {
  const trimFilter = ({ range: { startMs, endMs }, speed }: AudioSegment, label: string) => {
    const tempo = speed !== 1 ? `,atempo=${speed}` : '';
    return `[${audioInputIndex}:a]atrim=start=${startMs / 1000}:end=${endMs / 1000},asetpts=PTS-STARTPTS${tempo}[${label}]`;
  };

  if (segments.length === 1) {
    return { filters: [trimFilter(segments[0], 'aout')], outLabel: '[aout]' };
  }

  const filters: string[] = [];
  const labels: string[] = [];
  segments.forEach((segment, i) => {
    const label = `a${i}`;
    filters.push(trimFilter(segment, label));
    labels.push(`[${label}]`);
  });
  filters.push(`${labels.join('')}concat=n=${segments.length}:v=0:a=1[aout]`);

  return { filters, outLabel: '[aout]' };
}

export interface CreateEncoderOptions {
  outputPath: string;
  format: ExportFormat;
  codec: ExportCodec;
  width: number;
  height: number;
  frameRate: number;
  quality: number;
  sourceVideoPath: string;
  /** Ordered kept ranges + speed (ms, source-relative) -- see ExportOptions.segments. */
  segments: AudioSegment[];
  /** From video-probe.ts's probeSource -- skips audio entirely when false. */
  hasAudio: boolean;
}

export interface Encoder {
  command: FfmpegCommand;
  stdin: Writable;
}

/**
 * Builds (but does not start) an ffmpeg process that reads composited RGBA
 * frames from `stdin` and muxes them with the original source's audio track
 * (trimmed/concatenated to match the kept segments), encoding to the
 * requested format/codec. Caller attaches progress/error/end listeners, then
 * calls `command.run()`.
 */
export async function createEncoder(opts: CreateEncoderOptions): Promise<Encoder> {
  const {
    outputPath,
    format,
    codec,
    width,
    height,
    frameRate,
    quality,
    sourceVideoPath,
    segments,
    hasAudio
  } = opts;

  const videoInput = new PassThrough();
  const command = ffmpeg()
    .input(videoInput)
    .inputFormat('rawvideo')
    .inputOptions(['-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', `${frameRate}`]);

  if (format === 'gif') {
    command
      .complexFilter('[0:v] split [a][b]; [a] palettegen [p]; [b][p] paletteuse')
      .outputFormat('gif')
      .output(outputPath);
    return { command, stdin: videoInput };
  }

  const encoder = await resolveVideoEncoder(format, codec);
  const { crf, preset } = qualityToSettings(quality);

  if (hasAudio && segments.length > 0) {
    command.input(sourceVideoPath);
    const { filters, outLabel } = buildAudioConcatFilter(segments, 1);
    command.complexFilter(filters).outputOptions(['-map', '0:v', '-map', outLabel, '-shortest']);
  } else {
    command.outputOptions(['-map', '0:v']);
  }

  // The RGBA->YUV conversion must be pinned to BT.709: swscale otherwise
  // converts with untagged BT.601 coefficients while players assume BT.709
  // for HD, visibly shifting colors. `scale` (no resize) sets the matrix,
  // `format` forces the conversion to happen inside that scale instance, and
  // the flags write the colr/VUI metadata so players stop guessing.
  command
    .videoCodec(encoder)
    .videoFilters(['scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p'])
    .outputOptions([
      '-pix_fmt',
      'yuv420p',
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-color_range',
      'tv'
    ]);
  if (encoder === 'libvpx-vp9') {
    command.outputOptions(['-crf', `${crf}`, '-b:v', '0']);
  } else {
    command.outputOptions(['-crf', `${crf}`, '-preset', preset]);
    if (encoder === 'libx265') command.outputOptions(['-tag:v', 'hvc1']);
  }

  if (hasAudio && segments.length > 0) {
    if (format === 'webm') {
      command.audioCodec('libopus');
    } else {
      command.audioCodec('aac').audioBitrate('192k');
    }
  }
  if (format === 'mp4' || format === 'mov') {
    command.outputOptions(['-movflags', '+faststart']);
  }

  command.outputFormat(format).output(outputPath);

  return { command, stdin: videoInput };
}

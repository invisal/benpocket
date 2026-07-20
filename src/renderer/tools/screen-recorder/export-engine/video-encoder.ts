import type { Writable } from 'stream';
import { execa, type ResultPromise } from './node-bridge';
import type { ExportCodec, ExportFormat } from '@screen-recorder/types/export';
import type { ClipSpeed, TimeRange } from '@screen-recorder/types/timeline';
import { FFMPEG_PATH } from './ffmpeg-config';

let encoderNamesCache: Set<string> | null = null;

/** Parses `ffmpeg -encoders`' listing: each encoder line is a 6-char capability
 * flag block, whitespace, the encoder name, whitespace, then a description
 * (e.g. ` V....D h264_videotoolbox    VideoToolbox H.264 Encoder (codec h264)`).
 * The legend lines above the listing (` V..... = Video`) incidentally match
 * the same shape and capture `=` as a "name" -- harmless, since callers only
 * ever check membership of specific known encoder strings. */
async function getAvailableEncoderNames(): Promise<Set<string>> {
  if (encoderNamesCache) return encoderNamesCache;

  const { stdout } = await execa(FFMPEG_PATH, ['-hide_banner', '-encoders']);
  const names = new Set<string>();
  const lineRe = /^\s*\S{6}\s+(\S+)/;
  for (const line of stdout.split('\n')) {
    const match = lineRe.exec(line);
    if (match) names.add(match[1]);
  }
  encoderNamesCache = names;
  return names;
}

const CODEC_TO_ENCODER: Record<ExportCodec, string> = {
  h264: 'libx264',
  h265: 'libx265',
  av1: 'libaom-av1'
};

/**
 * Hardware-encoder candidates per codec, in try-order, restricted to the
 * platform(s) they can plausibly exist on. `ffmpeg -encoders` only reports
 * what the ffmpeg *build* was compiled with, not whether the hardware is
 * actually present -- `isEncoderFunctional` below runs a real 2-frame encode
 * before trusting one, so e.g. an `h264_nvenc`-capable ffmpeg build on a
 * machine with no NVIDIA GPU falls through to the next candidate instead of
 * failing the whole export.
 */
const CODEC_TO_HW_ENCODERS: Partial<
  Record<ExportCodec, { name: string; platforms: NodeJS.Platform[] }[]>
> = {
  h264: [
    { name: 'h264_videotoolbox', platforms: ['darwin'] },
    { name: 'h264_nvenc', platforms: ['win32', 'linux'] },
    { name: 'h264_qsv', platforms: ['win32', 'linux'] },
    { name: 'h264_amf', platforms: ['win32'] }
  ],
  h265: [
    { name: 'hevc_videotoolbox', platforms: ['darwin'] },
    { name: 'hevc_nvenc', platforms: ['win32', 'linux'] },
    { name: 'hevc_qsv', platforms: ['win32', 'linux'] },
    { name: 'hevc_amf', platforms: ['win32'] }
  ]
};

/**
 * `libaom-av1` (the encoder above) is notoriously slow -- tens of seconds
 * per encoded second of video is common. `libsvtav1` targets the same AV1
 * bitstream at comparable quality/bitrate but is built for throughput
 * instead, typically an order of magnitude faster. No hardware AV1 encoder
 * is common enough to rely on yet, so this is the best available lever for AV1.
 */
const CODEC_TO_FAST_SW_ENCODER: Partial<Record<ExportCodec, string>> = {
  av1: 'libsvtav1'
};

const functionalEncoderCache = new Map<string, boolean>();

/** Runs a throwaway 2-frame encode through `encoder` to confirm it actually works on this machine, not just that ffmpeg was compiled with it. Result is cached for the process lifetime. */
async function isEncoderFunctional(encoder: string): Promise<boolean> {
  const cached = functionalEncoderCache.get(encoder);
  if (cached !== undefined) return cached;

  let works = false;
  try {
    await execa(
      FFMPEG_PATH,
      [
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=64x64:d=0.1',
        '-frames:v',
        '2',
        '-vcodec',
        encoder,
        '-f',
        'null',
        '-'
      ],
      { timeout: 5000 }
    );
    works = true;
  } catch {
    works = false;
  }
  functionalEncoderCache.set(encoder, works);
  return works;
}

/** WebM cannot legally hold H.264/H.265, so `format:'webm'` always forces VP9. */
export async function resolveVideoEncoder(
  format: ExportFormat,
  codec: ExportCodec
): Promise<string> {
  if (format === 'webm') {
    console.warn(`webm export always uses VP9; ignoring requested codec "${codec}"`);
    return 'libvpx-vp9';
  }

  const available = await getAvailableEncoderNames();

  const hwCandidates = (CODEC_TO_HW_ENCODERS[codec] ?? []).filter((c) =>
    c.platforms.includes(process.platform)
  );
  for (const candidate of hwCandidates) {
    if (available.has(candidate.name) && (await isEncoderFunctional(candidate.name))) {
      return candidate.name;
    }
  }

  const fastSwEncoder = CODEC_TO_FAST_SW_ENCODER[codec];
  if (fastSwEncoder && available.has(fastSwEncoder)) return fastSwEncoder;

  const encoder = CODEC_TO_ENCODER[codec];
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

/** SVT-AV1 preset is a separate 0 (slowest/best)-13 (fastest) numeric scale, not the x264-style named presets above. */
function qualityToSvtAv1Settings(quality: number): { crf: number; preset: number } {
  if (quality <= 25) return { crf: 40, preset: 10 };
  if (quality <= 60) return { crf: 32, preset: 8 };
  if (quality <= 90) return { crf: 26, preset: 5 };
  return { crf: 20, preset: 2 };
}

/**
 * Hardware encoders have no CRF-equivalent constant-quality mode in this
 * ffmpeg build -- only bitrate-based rate control, so `quality` is mapped to
 * a target bits-per-pixel instead. Ranges chosen to land near the same file
 * size as the equivalent software CRF tier above for a typical screen
 * recording. Shared by VideoToolbox/NVENC/QSV/AMF -- all bitrate-controlled.
 */
function qualityToBitsPerPixel(quality: number): number {
  if (quality <= 25) return 0.06;
  if (quality <= 60) return 0.1;
  if (quality <= 90) return 0.14;
  return 0.2;
}

function hardwareEncoderBitrate(
  width: number,
  height: number,
  frameRate: number,
  quality: number
): number {
  return Math.round(width * height * frameRate * qualityToBitsPerPixel(quality));
}

function isHardwareEncoder(encoder: string): boolean {
  return (
    encoder.endsWith('_videotoolbox') ||
    encoder.endsWith('_nvenc') ||
    encoder.endsWith('_qsv') ||
    encoder.endsWith('_amf')
  );
}

interface AudioSegment {
  range: TimeRange;
  speed: ClipSpeed;
}

/**
 * Builds the filter-graph statements that extract each kept segment's audio
 * and concatenate them in order. A single ffmpeg input can only be seeked
 * to one range, but `atrim` operates on presentation timestamps and can be
 * applied to the *same* decoded input multiple times, so the whole audio
 * track is decoded once and carved up here instead of re-seeking per
 * segment. Each segment's own speed is applied via `atempo` (valid for
 * 0.5-2.0 in a single instance, which covers the full `ClipSpeed` range with
 * no chaining) so sped-up/slowed audio stays in sync with the video's own
 * `setpts` rescaling in video-decoder.ts. Returns the filter strings plus
 * the label to map in `-map`; caller joins the strings with `;` to form the
 * final `-filter_complex` argument.
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
  command: ResultPromise;
  stdin: Writable;
}

/**
 * Spawns an ffmpeg process that reads composited RGBA frames from `stdin`
 * (as produced by the PixiJS rendering engine, not a CPU compositor) and
 * muxes them with the original source's audio track (trimmed/concatenated
 * to match the kept segments), encoding to the requested format/codec.
 * Already running by the time this returns -- caller attaches `.catch()`
 * for errors, awaits `command` (or `command.then()`) for completion, and
 * writes frames to `stdin`.
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

  const inputArgs = [
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${width}x${height}`,
    '-r',
    `${frameRate}`,
    '-i',
    'pipe:0'
  ];

  if (format === 'gif') {
    const args = [
      ...inputArgs,
      '-y',
      '-filter_complex',
      '[0:v] split [a][b]; [a] palettegen [p]; [b][p] paletteuse',
      '-f',
      'gif',
      outputPath
    ];
    const command = execa(FFMPEG_PATH, args, {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      buffer: false
    });
    return { command, stdin: command.stdin as Writable };
  }

  const encoder = await resolveVideoEncoder(format, codec);
  const { crf, preset } = qualityToSettings(quality);
  const hasAudioSegments = hasAudio && segments.length > 0;

  const args = [...inputArgs];
  if (hasAudioSegments) args.push('-i', sourceVideoPath);
  args.push('-y');

  let outLabel = '';
  if (hasAudioSegments) {
    const built = buildAudioConcatFilter(segments, 1);
    outLabel = built.outLabel;
    args.push('-filter_complex', built.filters.join(';'));
    if (format === 'webm') {
      args.push('-acodec', 'libopus');
    } else {
      args.push('-acodec', 'aac', '-b:a', '192k');
    }
  }

  args.push('-vcodec', encoder);
  // The RGBA->YUV conversion must be pinned to BT.709: swscale otherwise
  // converts with untagged BT.601 coefficients while players assume BT.709
  // for HD, visibly shifting colors. `scale` (no resize) sets the matrix,
  // `format` forces the conversion to happen inside that scale instance, and
  // the flags below write the colr/VUI metadata so players stop guessing.
  args.push('-filter:v', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p');

  if (hasAudioSegments) {
    args.push('-map', '0:v', '-map', outLabel, '-shortest');
  } else {
    args.push('-map', '0:v');
  }
  args.push(
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
  );

  if (encoder === 'libvpx-vp9') {
    args.push('-crf', `${crf}`, '-b:v', '0');
  } else if (isHardwareEncoder(encoder)) {
    args.push('-b:v', `${hardwareEncoderBitrate(width, height, frameRate, quality)}`);
    if (encoder.startsWith('hevc_')) args.push('-tag:v', 'hvc1');
  } else if (encoder === 'libsvtav1') {
    const svt = qualityToSvtAv1Settings(quality);
    args.push('-crf', `${svt.crf}`, '-preset', `${svt.preset}`);
  } else {
    args.push('-crf', `${crf}`, '-preset', preset);
    if (encoder === 'libx265') args.push('-tag:v', 'hvc1');
  }

  if (format === 'mp4' || format === 'mov') {
    args.push('-movflags', '+faststart');
  }

  args.push('-f', format, outputPath);

  const command = execa(FFMPEG_PATH, args, {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    buffer: false
  });
  return { command, stdin: command.stdin as Writable };
}

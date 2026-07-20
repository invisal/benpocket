import { execa } from './node-bridge';
import { FFPROBE_PATH } from './ffmpeg-config';

export interface SourceMeta {
  width: number;
  height: number;
  durationMs: number;
  hasAudio: boolean;
}

interface FfprobeStream {
  codec_type: string;
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  streams: FfprobeStream[];
  format: { duration?: string };
}

/** ffprobe-static is used only to inspect media metadata -- decoding/encoding go through video-decoder.ts/video-encoder.ts's own ffmpeg subprocesses. */
export async function probeSource(filePath: string): Promise<SourceMeta> {
  const { stdout } = await execa(FFPROBE_PATH, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath
  ]);

  const data = JSON.parse(stdout) as FfprobeOutput;
  const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
  if (!videoStream?.width || !videoStream.height) {
    throw new Error(`No video stream found in ${filePath}`);
  }
  const hasAudio = data.streams.some((stream) => stream.codec_type === 'audio');

  return {
    width: videoStream.width,
    height: videoStream.height,
    durationMs: Math.round((Number(data.format.duration) || 0) * 1000),
    hasAudio
  };
}

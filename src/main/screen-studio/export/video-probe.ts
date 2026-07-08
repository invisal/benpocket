import ffmpeg from 'fluent-ffmpeg';
import './ffmpeg-config';

export interface SourceMeta {
  width: number;
  height: number;
  durationMs: number;
  hasAudio: boolean;
}

export function probeSource(filePath: string): Promise<SourceMeta> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
      if (!videoStream?.width || !videoStream.height) {
        reject(new Error(`No video stream found in ${filePath}`));
        return;
      }
      const hasAudio = data.streams.some((stream) => stream.codec_type === 'audio');
      resolve({
        width: videoStream.width,
        height: videoStream.height,
        durationMs: Math.round((data.format.duration ?? 0) * 1000),
        hasAudio
      });
    });
  });
}

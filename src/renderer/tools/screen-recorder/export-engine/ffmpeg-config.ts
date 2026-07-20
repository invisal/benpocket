import { ffmpegStaticPath, ffprobeStaticModule } from './node-bridge';

if (!ffmpegStaticPath) {
  throw new Error('ffmpeg-static did not resolve a binary for this platform');
}

export const FFMPEG_PATH: string = ffmpegStaticPath;
export const FFPROBE_PATH: string = ffprobeStaticModule.path;

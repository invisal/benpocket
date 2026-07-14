import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  FileVideo,
  type LucideIcon
} from 'lucide-react';

// Generic, extension-based fallback used both while a driver's native icon is
// still loading (local) and permanently for drivers with no native icon lookup (R2).
const EXTENSION_ICONS: Record<string, LucideIcon> = {
  txt: FileText,
  md: FileText,
  rtf: FileText,
  json: FileJson,
  yaml: FileJson,
  yml: FileJson,
  xml: FileJson,
  toml: FileJson,
  ini: FileJson,
  js: FileCode2,
  ts: FileCode2,
  tsx: FileCode2,
  jsx: FileCode2,
  py: FileCode2,
  go: FileCode2,
  rs: FileCode2,
  java: FileCode2,
  c: FileCode2,
  cpp: FileCode2,
  html: FileCode2,
  css: FileCode2,
  sh: FileCode2,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  svg: FileImage,
  webp: FileImage,
  bmp: FileImage,
  mp4: FileVideo,
  mov: FileVideo,
  avi: FileVideo,
  mkv: FileVideo,
  webm: FileVideo,
  mp3: FileAudio,
  wav: FileAudio,
  flac: FileAudio,
  ogg: FileAudio,
  zip: FileArchive,
  tar: FileArchive,
  gz: FileArchive,
  rar: FileArchive,
  '7z': FileArchive
};

export function ExtensionIcon({ extension, className }: { extension: string; className?: string }) {
  const Icon = EXTENSION_ICONS[extension] ?? FileIcon;
  return <Icon className={className} />;
}

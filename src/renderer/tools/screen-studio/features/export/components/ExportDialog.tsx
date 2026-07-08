import type { JSX } from 'react';
import { useExportStore } from '../store/export-store';

// TODO: output path picker and a progress bar wired to
// screenStudio.export.onProgress; disable the Export button while a job runs.
export function ExportDialog(): JSX.Element {
  const { format, aspectRatio, setFormat, setAspectRatio } = useExportStore();

  return (
    <div className="flex items-center gap-3 border-t border-white/10 p-3 text-xs">
      <select value={format} onChange={(e) => setFormat(e.target.value as 'mp4' | 'gif')}>
        <option value="mp4">MP4</option>
        <option value="gif">GIF</option>
      </select>
      <select
        value={aspectRatio}
        onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16' | '1:1' | '4:3')}
      >
        <option value="16:9">16:9</option>
        <option value="9:16">9:16</option>
        <option value="1:1">1:1</option>
        <option value="4:3">4:3</option>
      </select>
      <button className="ml-auto rounded-lg bg-accent px-3 py-1.5 font-medium hover:bg-accent-hover">
        Export
      </button>
    </div>
  );
}

import type { JSX } from 'react';
import { useAppStore } from '../../app/app-store';

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function formatTimeAgo(timestampMs: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

// TODO: back this with a real recordings index (main/store persists project
// metadata + thumbnails to disk) instead of only ever showing the single
// most recent in-memory recording.
export function LibraryPage(): JSX.Element {
  const lastRecording = useAppStore((state) => state.lastRecording);
  const setRoute = useAppStore((state) => state.setRoute);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Library</h1>

      {!lastRecording ? (
        <p className="text-sm text-white/40">
          No recordings yet. Head to Record to make your first one.
        </p>
      ) : (
        <button
          onClick={() => setRoute('editor')}
          className="w-64 rounded-xl border border-line bg-surface-raised p-2 text-left hover:border-accent/60"
        >
          <video
            src={lastRecording.previewUrl}
            preload="metadata"
            muted
            className="aspect-video w-full rounded-lg bg-black object-cover"
            onError={(e) =>
              console.error('[library] thumbnail failed to load:', e.currentTarget.error)
            }
          />
          <p className="mt-2 truncate text-sm">Screen Recording</p>
          <p className="text-xs text-white/40">
            {formatBytes(lastRecording.sizeBytes)} · {formatTimeAgo(lastRecording.createdAt)}
          </p>
        </button>
      )}
    </div>
  );
}

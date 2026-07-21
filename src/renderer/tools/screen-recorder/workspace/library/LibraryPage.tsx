import type { JSX } from 'react';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
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
  const clearLastRecording = useAppStore((state) => state.clearLastRecording);

  // Best-effort disk cleanup, then always clears the library entry --
  // there's no persisted recordings index yet (see the TODO above) to
  // re-surface an orphaned file through later anyway, so leaving a stale
  // card around just because the delete IPC failed would help no one.
  // `filePath` is null if the original save itself already failed, in
  // which case there's nothing on disk to remove at all.
  async function handleRemove(recording: NonNullable<typeof lastRecording>): Promise<void> {
    if (!window.confirm('Remove this recording? This deletes the saved file and can’t be undone.'))
      return;
    if (recording.filePath) {
      try {
        await window.screenRecorder.recording.deleteFile(recording.filePath);
      } catch (err) {
        console.error('[library] failed to delete recording file:', err);
      }
    }
    if (recording.webcamFilePath) {
      try {
        await window.screenRecorder.recording.deleteFile(recording.webcamFilePath);
      } catch (err) {
        console.error('[library] failed to delete webcam recording file:', err);
      }
    }
    URL.revokeObjectURL(recording.previewUrl);
    if (recording.webcamPreviewUrl) URL.revokeObjectURL(recording.webcamPreviewUrl);
    clearLastRecording();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Library</h1>

      {!lastRecording ? (
        <p className="text-sm text-muted-foreground">
          No recordings yet. Head to Record to make your first one.
        </p>
      ) : (
        <ContextMenu.Root>
          <ContextMenu.Trigger
            render={
              <button
                onClick={() => setRoute('editor')}
                className="w-64 rounded-xl border border-line bg-surface p-2 text-left transition-colors hover:bg-surface-2 hover:border-accent/60"
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
                <p className="text-xs text-muted-foreground">
                  {formatBytes(lastRecording.sizeBytes)} · {formatTimeAgo(lastRecording.createdAt)}
                </p>
              </button>
            }
          />
          <ContextMenu.Content>
            <ContextMenu.Item onClick={() => setRoute('editor')}>Open</ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item onClick={() => void handleRemove(lastRecording)}>
              Remove
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Root>
      )}
    </div>
  );
}

import { Circle, Film, Square } from 'lucide-react';
import { useAppStore } from '../app/app-store';
import { useRecentRecordingsStore, type RecentRecording } from '../app/recent-recordings-store';
import { formatBytes, formatTimeAgo } from '../lib/format';
import { Button } from '@renderer/components/ui/Button';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { openRecorderToolbarFor } from '@screen-recorder/features/recording/lib/open-recorder-toolbar';

export const ScreenRecorderSidebar: React.FC = () => {
  const isRecording = useAppStore((state) => state.isRecording);
  const isRecorderToolbarOpen = useAppStore((state) => state.isRecorderToolbarOpen);
  const route = useAppStore((state) => state.route);
  const setRoute = useAppStore((state) => state.setRoute);
  const lastRecording = useAppStore((state) => state.lastRecording);
  const recentRecordings = useRecentRecordingsStore((state) => state.recordings);
  const removeRecentRecording = useRecentRecordingsStore((state) => state.removeRecording);

  async function handleNewRecord(): Promise<void> {
    const sources = await window.screenRecorder.recording.getCaptureSources();
    // Prefer the primary display -- desktopCapturer doesn't enumerate
    // screens in any guaranteed order, so falling back to "the first screen
    // source" would otherwise flip to whichever monitor the OS happened to
    // list first (e.g. a newly-connected external one) rather than actually
    // meaning "the main screen".
    const defaultSource =
      sources.find((s) => s.type === 'screen' && s.isPrimaryDisplay) ??
      sources.find((s) => s.type === 'screen') ??
      sources[0];
    if (defaultSource) await openRecorderToolbarFor(defaultSource);
  }

  // Recordings from this same session still have their capture in memory
  // (`lastRecording`), so those open straight into the editor; anything
  // else -- a previous session's entry -- has no blob to reload, so it
  // opens in the OS's default player instead. See recording-handlers.ts.
  function handleOpenRecent(recording: RecentRecording): void {
    if (!recording.filePath) return;
    if (recording.filePath === lastRecording?.filePath) {
      setRoute('editor');
      return;
    }
    void window.screenRecorder.recording.openFile(recording.filePath).catch((err) => {
      console.error('[sidebar] failed to open recent recording:', err);
    });
  }

  // isRecorderToolbarOpen alone already covers isRecording (a recording
  // can't be running without the toolbar that started it also being open),
  // but isRecording is kept in the condition since it's the more direct,
  // obviously-correct reason to disable this if the two ever desync.
  const disabled = route === 'editor' || isRecording || isRecorderToolbarOpen;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          ScreenRecorder
        </span>
      </div>

      <Button onClick={handleNewRecord} variant="secondary" className="w-full" disabled={disabled}>
        {isRecording ? (
          <Square size={12} className="text-muted-foreground" fill="currentColor" />
        ) : (
          <Circle size={12} className="text-danger" fill="currentColor" />
        )}
        <span>Launch Recorder</span>
      </Button>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent
        </span>

        {recentRecordings.length === 0 ? (
          <p className="text-xs text-muted-foreground">Your last 5 recordings will show up here.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {recentRecordings.map((recording) => (
              <ContextMenu.Root key={recording.id}>
                <ContextMenu.Trigger
                  render={
                    <button
                      onClick={() => handleOpenRecent(recording)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <Film size={14} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{recording.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {formatTimeAgo(recording.createdAt)} · {formatBytes(recording.sizeBytes)}
                        </span>
                      </span>
                    </button>
                  }
                />
                <ContextMenu.Content>
                  <ContextMenu.Item onClick={() => handleOpenRecent(recording)}>
                    Open
                  </ContextMenu.Item>
                  <ContextMenu.Separator />
                  <ContextMenu.Item onClick={() => removeRecentRecording(recording.id)}>
                    Remove from Recent
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Root>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

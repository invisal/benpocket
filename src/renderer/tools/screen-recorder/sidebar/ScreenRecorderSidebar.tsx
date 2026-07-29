import { ArrowDownUp, Clapperboard, Film, FolderOpen, Settings, Upload } from 'lucide-react';
import { useAppStore, type ScreenRecorderRoute } from '../app/app-store';
import { useRecentRecordingsStore, type RecentRecording } from '../app/recent-recordings-store';
import { useExportStore } from '../features/export/store/export-store';
import { formatBytes, formatTimeAgo } from '../lib/format';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { cn } from '../lib/utils';

const NAV_ITEMS: {
  route: ScreenRecorderRoute;
  label: string;
  icon: typeof FolderOpen;
  /** Only 'editor' needs this -- there's nothing to edit until a recording exists. */
  requiresRecording?: boolean;
}[] = [
  { route: 'editor', label: 'Editor', icon: Clapperboard, requiresRecording: true },
  { route: 'library', label: 'Library', icon: FolderOpen },
  { route: 'settings', label: 'Settings', icon: Settings }
];

export const ScreenRecorderSidebar: React.FC = () => {
  const route = useAppStore((state) => state.route);
  const setRoute = useAppStore((state) => state.setRoute);
  const lastRecording = useAppStore((state) => state.lastRecording);
  const recentRecordings = useRecentRecordingsStore((state) => state.recordings);
  const removeRecentRecording = useRecentRecordingsStore((state) => state.removeRecording);
  const isExporting = useExportStore((state) => state.isExporting);

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

  return (
    <div className="flex h-full w-full">
      <Tooltip.Provider delay={200} closeDelay={0}>
        <nav className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-line py-3">
          {NAV_ITEMS.map(({ route: itemRoute, label, icon: Icon, requiresRecording }) => {
            const needsRecording = requiresRecording && !lastRecording;
            const itemDisabled = isExporting || needsRecording;
            return (
              <Tooltip.Root key={itemRoute}>
                <Tooltip.Trigger
                  render={
                    <button
                      onClick={() => !itemDisabled && setRoute(itemRoute)}
                      disabled={itemDisabled}
                      aria-label={label}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30',
                        route === itemRoute
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                      )}
                    >
                      <Icon size={16} strokeWidth={1.75} />
                    </button>
                  }
                />
                <Tooltip.Content side="right">
                  {isExporting
                    ? 'Export in progress'
                    : needsRecording
                      ? 'Record something first'
                      : label}
                </Tooltip.Content>
              </Tooltip.Root>
            );
          })}
        </nav>
      </Tooltip.Provider>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Assets</span>
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <button
              title="Not available yet"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-surface-2"
            >
              <ArrowDownUp size={12} />
            </button>
            <button
              title="Not available yet"
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium hover:bg-surface-2"
            >
              <Upload size={12} /> Import
            </button>
          </div>
        </div>

        {recentRecordings.length === 0 ? (
          <p className="text-xs text-muted-foreground">Your last 5 recordings will show up here.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {recentRecordings.map((recording) => (
              <ContextMenu.Root key={recording.id}>
                <ContextMenu.Trigger
                  render={
                    <button
                      onClick={() => handleOpenRecent(recording)}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-lg p-1.5 text-left transition-colors hover:bg-surface-2'
                      )}
                    >
                      <span className="flex aspect-video w-full items-center justify-center rounded-md bg-surface-3">
                        <Film size={18} className="text-muted-foreground" />
                      </span>
                      <span className="min-w-0 w-full">
                        <span className="block truncate text-xs">{recording.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
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

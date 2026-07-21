import type { ComponentType, JSX } from 'react';
import { FolderOpen, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { useAppStore, type ScreenRecorderRoute } from './app/app-store';
import { cn } from './lib/utils';
import { EditorPage } from './workspace/editor/EditorPage';
import { LibraryPage } from './workspace/library/LibraryPage';
import { PresetsPage } from './workspace/presets/PresetsPage';
import { SettingsPage } from './workspace/settings/SettingsPage';
import { ScreenRecorderSidebar } from './sidebar/ScreenRecorderSidebar';
import { CutTimeline } from './features/timeline/components/CutTimeline';
import { RecordingControllerProvider } from './features/recording/context/RecordingControllerContext';
import { RecorderToolbarBridge } from './features/recording/components/RecorderToolbarBridge';
import { ExportPopoverButton } from './features/export/components/ExportPopoverButton';

const NAV_ITEMS: {
  route: ScreenRecorderRoute;
  label: string;
  icon: ComponentType<{ size?: number }>;
}[] = [
  { route: 'library', label: 'Library', icon: FolderOpen },
  { route: 'presets', label: 'Presets', icon: Sliders },
  { route: 'settings', label: 'Settings', icon: SettingsIcon }
];

export function ScreenRecorderApp(): JSX.Element {
  const route = useAppStore((state) => state.route);
  const setRoute = useAppStore((state) => state.setRoute);
  const lastRecording = useAppStore((state) => state.lastRecording);

  function handleNavClick(itemRoute: ScreenRecorderRoute): void {
    setRoute(itemRoute);
  }

  return (
    <RecordingControllerProvider>
      <RecorderToolbarBridge />
      <div className="flex flex-1 flex-col min-h-0 bg-surface text-foreground">
        <nav className="flex shrink-0 items-center gap-1 border-b border-line px-4 py-2">
          {NAV_ITEMS.map(({ route: itemRoute, label, icon: Icon }) => (
            <button
              key={itemRoute}
              onClick={() => handleNavClick(itemRoute)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                route === itemRoute
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
          <button
            onClick={() => lastRecording && setRoute('editor')}
            disabled={!lastRecording}
            title={lastRecording ? undefined : 'Record something first'}
            className={cn(
              'ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-30',
              route === 'editor'
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
            )}
          >
            Editor
          </button>
          {route === 'editor' && <ExportPopoverButton />}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <div className="w-64 shrink-0 overflow-y-auto border-r border-line bg-surface p-3">
              <ScreenRecorderSidebar />
            </div>

            <div className="flex min-h-0 flex-1 overflow-auto">
              {route === 'editor' && <EditorPage />}
              {route === 'library' && <LibraryPage />}
              {route === 'presets' && <PresetsPage />}
              {route === 'settings' && <SettingsPage />}
            </div>
          </div>

          {/* Rendered here (not inside EditorPage) so it spans the full app
            width, isolated from the sidebar above rather than squeezed to
            the content column's width. Selection/zoom are shared via
            timeline-store since this is no longer EditorPage's child. */}
          {route === 'editor' && <CutTimeline />}
        </div>
      </div>
    </RecordingControllerProvider>
  );
}

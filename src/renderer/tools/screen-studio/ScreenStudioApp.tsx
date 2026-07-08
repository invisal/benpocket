import type { ComponentType, JSX } from 'react';
import { Circle, FolderOpen, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { useAppStore, type ScreenStudioRoute } from './app/app-store';
import { cn } from './lib/utils';
import { RecordSetupPage } from './workspace/record-setup/RecordSetupPage';
import { EditorPage } from './workspace/editor/EditorPage';
import { LibraryPage } from './workspace/library/LibraryPage';
import { PresetsPage } from './workspace/presets/PresetsPage';
import { SettingsPage } from './workspace/settings/SettingsPage';
import { ExportButton } from './features/export/components/ExportButton';

// `recording-hud` is intentionally excluded: it's rendered into its own
// frameless always-on-top window (main/screen-studio/windows/recorder-bar-window.ts),
// not navigated to inside the main workspace.
const NAV_ITEMS: {
  route: ScreenStudioRoute;
  label: string;
  icon: ComponentType<{ size?: number }>;
}[] = [
  { route: 'record-setup', label: 'Record', icon: Circle },
  { route: 'library', label: 'Library', icon: FolderOpen },
  { route: 'presets', label: 'Presets', icon: Sliders },
  { route: 'settings', label: 'Settings', icon: SettingsIcon }
];

export function ScreenStudioApp(): JSX.Element {
  const route = useAppStore((state) => state.route);
  const setRoute = useAppStore((state) => state.setRoute);
  const lastRecording = useAppStore((state) => state.lastRecording);

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-surface text-white/90">
      <nav className="flex shrink-0 items-center gap-1 border-b border-line px-4 py-2">
        {NAV_ITEMS.map(({ route: itemRoute, label, icon: Icon }) => (
          <button
            key={itemRoute}
            onClick={() => setRoute(itemRoute)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              route === itemRoute
                ? 'bg-accent/10 text-accent'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
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
              : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          )}
        >
          Editor
        </button>

        <ExportButton />
      </nav>

      <div className="flex min-h-0 flex-1 overflow-auto">
        {route === 'record-setup' && <RecordSetupPage />}
        {route === 'editor' && <EditorPage />}
        {route === 'library' && <LibraryPage />}
        {route === 'presets' && <PresetsPage />}
        {route === 'settings' && <SettingsPage />}
      </div>
    </div>
  );
}

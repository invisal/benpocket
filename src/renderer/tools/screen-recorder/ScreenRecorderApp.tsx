import type { JSX } from 'react';
import { MessageSquare } from 'lucide-react';
import { useAppStore } from './app/app-store';
import { cn } from './lib/utils';
import { EditorPage } from './workspace/editor/EditorPage';
import { LibraryPage } from './workspace/library/LibraryPage';
import { SettingsPage } from './workspace/settings/SettingsPage';
import { ScreenRecorderSidebar } from './sidebar/ScreenRecorderSidebar';
import { CutTimeline } from './features/timeline/components/CutTimeline';
import { RecordingControllerProvider } from './features/recording/context/RecordingControllerContext';
import { RecorderToolbarBridge } from './features/recording/components/RecorderToolbarBridge';
import { ExportPopoverButton } from './features/export/components/ExportPopoverButton';
import { LaunchRecorderButton } from './features/recording/components/LaunchRecorderButton';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;

export function ScreenRecorderApp(): JSX.Element {
  const route = useAppStore((state) => state.route);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);

  return (
    <RecordingControllerProvider>
      <RecorderToolbarBridge />
      <div className="flex flex-1 flex-col min-h-0 bg-surface-sunken text-foreground">
        <nav className="flex shrink-0 items-center gap-3 bg-surface px-4 py-2">
          <div className="flex shrink-0 items-center gap-2">
            <LaunchRecorderButton />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Decorative only -- there's no feedback flow wired up yet. */}
            <button
              title="Send feedback"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare size={13} />
                Send feedback
              </span>
            </button>
            <ExportPopoverButton disabled={route !== 'editor'} />
          </div>
        </nav>

        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
          <div className="flex min-h-0 flex-1 gap-2">
            <ResizablePanel
              edge="right"
              size={sidebarWidth}
              onResize={setSidebarWidth}
              min={SIDEBAR_MIN_WIDTH}
              max={SIDEBAR_MAX_WIDTH}
              className="flex overflow-y-auto rounded-lg border border-line bg-surface"
              handleClassName="z-40"
            >
              <ScreenRecorderSidebar />
            </ResizablePanel>

            <div
              className={cn(
                'flex min-h-0 flex-1 overflow-auto rounded-lg',
                route === 'editor' ? 'bg-surface-sunken' : 'border border-line bg-surface'
              )}
            >
              {route === 'editor' && <EditorPage />}
              {route === 'library' && <LibraryPage />}
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

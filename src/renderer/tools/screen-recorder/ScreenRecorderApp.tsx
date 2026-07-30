import type { JSX } from 'react';
import { useState } from 'react';
import { Flag, Loader2, Save } from 'lucide-react';
import { useAppStore } from './app/app-store';
import { useToastStore } from './app/toast-store';
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
import { SaveProjectDialog } from './features/project/components/SaveProjectDialog';
import { buildProjectSnapshot } from './features/project/lib/build-project-snapshot';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import { Button } from '@renderer/components/ui/Button';
import { ToastViewport } from './components/ui/toast';

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;

export function ScreenRecorderApp(): JSX.Element {
  const route = useAppStore((state) => state.route);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);
  const lastRecording = useAppStore((state) => state.lastRecording);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const projectName = useAppStore((state) => state.projectName);
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);
  const bumpProjectsVersion = useAppStore((state) => state.bumpProjectsVersion);
  const showToast = useToastStore((state) => state.showToast);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  // A project that's already been named once (has a `currentProjectId`) just
  // re-saves silently in place -- only the *first* save needs the dialog to
  // ask for a name. Errors surface as a toast rather than a dialog since
  // there's no form here to show a field-level error in.
  async function handleSaveClick(): Promise<void> {
    if (!currentProjectId) {
      setIsSaveDialogOpen(true);
      return;
    }
    const project = buildProjectSnapshot(projectName);
    if (!project) return;
    setIsQuickSaving(true);
    try {
      const ok = await window.screenRecorder.project.save(project);
      if (ok) {
        setCurrentProjectId(project.id);
        bumpProjectsVersion();
        showToast('Project saved');
      } else {
        showToast('Failed to save project', 'error');
      }
    } finally {
      setIsQuickSaving(false);
    }
  }

  return (
    <RecordingControllerProvider>
      <RecorderToolbarBridge />
      <div className="screen-recorder-app flex flex-1 flex-col min-h-0 bg-surface-sunken text-foreground">
        <nav className="flex shrink-0 items-center gap-3 bg-surface px-4 py-2">
          <div className="flex shrink-0 items-center gap-2">
            <LaunchRecorderButton />
            <Button
              onClick={() => void handleSaveClick()}
              disabled={route !== 'editor' || !lastRecording || isQuickSaving}
            >
              {isQuickSaving ? (
                <Loader2 size={12} className="animate-spin text-muted-foreground" />
              ) : (
                <Save size={12} className="text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-muted-foreground">
                {isQuickSaving ? 'Saving…' : 'Save'}
              </span>
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => window.open('https://github.com/invisal/benpocket/issues', '_blank')}
              title="Report an issue"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Flag size={13} />
                Report an issue
              </span>
            </button>
            <ExportPopoverButton disabled={route !== 'editor'} />
          </div>
        </nav>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
          <div className="flex min-h-0 flex-1 gap-1.5">
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

      <SaveProjectDialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen} />
      <ToastViewport />
    </RecordingControllerProvider>
  );
}

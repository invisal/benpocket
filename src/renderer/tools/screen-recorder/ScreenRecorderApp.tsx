import type { JSX } from 'react';
import { Activity, useCallback, useEffect, useState } from 'react';
import { Flag, Loader2, Save } from 'lucide-react';
import { useScreenRecorderStore } from './store/screen-recorder-store';
import { useToastStore } from './store/toast-store';
import { cn } from './lib/utils';
import { EditorPage } from './workspace/editor/EditorPage';
import { LibraryPage } from './workspace/library/LibraryPage';
import { SettingsPage } from './workspace/settings/SettingsPage';
import { ScreenRecorderSidebar } from './sidebar/ScreenRecorderSidebar';
import { CutTimeline } from './features/timeline/components/CutTimeline';
import { RecordingControllerProvider } from './features/recording/context/RecordingControllerContext';
import { RecorderToolbarBridge } from './features/recording/components/RecorderToolbarBridge';
import { ExportDialogButton } from './features/export/components/ExportDialog';
import { LaunchRecorderButton } from './features/recording/components/LaunchRecorderButton';
import { SaveProjectDialog } from './features/project/components/SaveProjectDialog';
import { buildProjectSnapshot } from './features/project/lib/build-project-snapshot';
import { resetHistory } from './features/history/store/history-store';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';
import { Button } from '@renderer/components/ui/Button';
import { ToolLayout } from '@renderer/components/layout/ToolLayout';
import { ToastViewport } from './components/ui/toast';

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const routes = [
  {
    id: 'editor',
    component: <EditorPage />
  },
  {
    id: 'library',
    component: <LibraryPage />
  },
  {
    id: 'settings',
    component: <SettingsPage />
  }
];
export function ScreenRecorderApp(): JSX.Element {
  const route = useScreenRecorderStore((state) => state.route);
  const sidebarWidth = useScreenRecorderStore((state) => state.sidebarWidth);
  const setSidebarWidth = useScreenRecorderStore((state) => state.setSidebarWidth);
  const lastRecording = useScreenRecorderStore((state) => state.lastRecording);
  const currentProjectId = useScreenRecorderStore((state) => state.currentProjectId);
  const projectName = useScreenRecorderStore((state) => state.projectName);
  const setCurrentProjectId = useScreenRecorderStore((state) => state.setCurrentProjectId);
  const bumpProjectsVersion = useScreenRecorderStore((state) => state.bumpProjectsVersion);
  const showToast = useToastStore((state) => state.showToast);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const handleSaveClick = useCallback(async (): Promise<void> => {
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
        resetHistory();
        showToast('Project saved');
      } else {
        showToast('Failed to save project', 'error');
      }
    } finally {
      setIsQuickSaving(false);
    }
  }, [currentProjectId, projectName, setCurrentProjectId, bumpProjectsVersion, showToast]);

  // Cmd/Ctrl+S is bound in use-editor-keyboard-shortcuts.ts (all editor
  // shortcuts live there) -- it can't call `handleSaveClick` directly since
  // that hook is scoped to EditorPage, not this component, and the actual
  // save flow needs this component's own dialog/toast state. It bumps
  // `saveRequestToken` instead; subscribed (not read reactively) so the
  // resulting `handleSaveClick` call happens from within the subscription's
  // own callback rather than synchronously in this effect's body.
  useEffect(() => {
    return useScreenRecorderStore.subscribe((state, prevState) => {
      if (state.saveRequestToken === prevState.saveRequestToken) return;
      if (route !== 'editor' || !lastRecording || isQuickSaving) return;
      void handleSaveClick();
    });
  }, [handleSaveClick, route, lastRecording, isQuickSaving]);

  return (
    <RecordingControllerProvider>
      <RecorderToolbarBridge />
      <ToolLayout.Title>
        {/* Not `titlebar-nodrag` itself -- only the two button-group islands
            below are, so the gap between them stays part of the ambient
            `titlebar-drag` row (AppShell.tsx) and the window can still be
            dragged from empty space in the title bar, same as before this
            replaced the plain-text title. */}
        <div className="flex w-full items-center gap-3">
          <div className="titlebar-nodrag flex shrink-0 items-center gap-2">
            <LaunchRecorderButton />
            <Button
              size="sm"
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

          <div className="titlebar-nodrag ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('https://github.com/invisal/benpocket/issues', '_blank')}
              title="Report an issue"
            >
              <Flag size={13} />
              <span>Report an issue</span>
            </Button>
            <ExportDialogButton disabled={route !== 'editor' || !lastRecording} />
          </div>
        </div>
      </ToolLayout.Title>

      <div className="screen-recorder-app flex flex-1 flex-col min-h-0 bg-surface-sunken text-foreground">
        <div className="flex min-h-0 flex-1 flex-col gap-1 dark:gap-1.5 p-1 dark:p-1.5">
          <div className="flex min-h-0 flex-1 gap-1 dark:gap-1.5">
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
              {routes.map((r) => {
                const isActive = route === r.id;
                return (
                  <Activity key={r.id} mode={isActive ? 'visible' : 'hidden'}>
                    {r.component}
                  </Activity>
                );
              })}
            </div>
          </div>

          <Activity mode={route === 'editor' && lastRecording ? 'visible' : 'hidden'}>
            <CutTimeline />
          </Activity>
        </div>
      </div>

      <SaveProjectDialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen} />
      <ToastViewport />
    </RecordingControllerProvider>
  );
}

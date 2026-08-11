import { useEffect, useRef, useState, type JSX } from 'react';
import {
  ArrowDownUp,
  Clapperboard,
  Film,
  FolderOpen,
  Loader2,
  Settings,
  Upload
} from 'lucide-react';
import type { ProjectSummary } from '@screen-recorder/types/project';
import { useAppStore, type ScreenRecorderRoute } from '../app/app-store';
import { useToastStore } from '../app/toast-store';
import { useExportStore } from '../features/export/store/export-store';
import { useOpenProject } from '../features/project/hooks/useOpenProject';
import { DiscardChangesDialog } from '../features/project/components/DiscardChangesDialog';
import { importVideoFile } from '../features/project/lib/import-video';
import { groupProjectsBySource } from '../features/project/lib/group-projects-by-source';
import { formatTimeAgo } from '../lib/format';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { cn } from '../lib/utils';

const MAX_RECENT_PROJECTS = 5;

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
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const projectsVersion = useAppStore((state) => state.projectsVersion);
  const isExporting = useExportStore((state) => state.isExporting);
  const showToast = useToastStore((state) => state.showToast);

  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const { loadingProjectId, openProject, pendingProject, confirmDiscard, cancelDiscard } =
    useOpenProject();
  const hasAutoSelectedRef = useRef(false);

  // Recent-projects list is separate from `lastRecording`'s persisted
  // metadata index -- it re-fetches on `projectsVersion` since, unlike
  // LibraryPage, this sidebar stays mounted across route changes and would
  // otherwise never notice a project saved during the current session.
  //
  // On the very first fetch (app launch), also resume the most recently
  // edited project automatically -- guarded by the ref so a save later in
  // the session (which bumps `projectsVersion` and re-runs this effect)
  // never does it again, and by `currentProjectId` so it doesn't clobber a
  // project the user already has open by the time this resolves.
  useEffect(() => {
    let cancelled = false;
    void window.screenRecorder.project.list().then((list) => {
      if (cancelled) return;
      // Kept unsliced (unlike each rendered section below, which caps
      // independently at MAX_RECENT_PROJECTS) so `list[0]` here is always
      // the single most-recently-updated project across both sources, for
      // auto-resume.
      setRecentProjects(list);

      if (!hasAutoSelectedRef.current) {
        hasAutoSelectedRef.current = true;
        const [mostRecent] = list;
        if (mostRecent && !currentProjectId) {
          // Switches to the editor route immediately, before `openProject`
          // has even started its IPC round trip -- EditorPage shows
          // `EditorLoading` for `isOpeningProject` (set inside
          // `useOpenProject`) rather than this leaving the user on whatever
          // screen they launched into with nothing visibly happening until
          // the whole load -- project JSON read, video file stat, store
          // hydration -- finishes and the route flips out from under them.
          setRoute('editor');
          void openProject(mostRecent);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectsVersion, currentProjectId, openProject, setRoute]);

  async function handleDeleteProject(project: ProjectSummary): Promise<void> {
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    const ok = await window.screenRecorder.project.remove(project.id);
    if (ok) setRecentProjects((prev) => prev.filter((p) => p.id !== project.id));
  }

  async function handleImport(): Promise<void> {
    setIsImporting(true);
    try {
      await importVideoFile();
    } catch (err) {
      console.error('[sidebar] failed to import video:', err);
      showToast('Failed to import video', 'error');
    } finally {
      setIsImporting(false);
    }
  }

  function renderProjectRow(project: ProjectSummary): JSX.Element {
    const isActive = project.id === currentProjectId;
    return (
      <ContextMenu.Root key={project.id}>
        <ContextMenu.Trigger
          render={
            <button
              onClick={() => void openProject(project)}
              disabled={loadingProjectId !== null}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors disabled:opacity-50',
                isActive ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-surface-2'
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3">
                <Film size={14} className="text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{project.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {loadingProjectId === project.id ? 'Loading…' : formatTimeAgo(project.createdAt)}
                </span>
              </span>
            </button>
          }
        />
        <ContextMenu.Content>
          <ContextMenu.Item onClick={() => void openProject(project)}>Open</ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item onClick={() => void handleDeleteProject(project)}>
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    );
  }

  const { recorded: recordedProjects, imported: importedProjects } =
    groupProjectsBySource(recentProjects);

  return (
    <div className="flex h-full w-full">
      <DiscardChangesDialog
        open={pendingProject !== null}
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />
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

      <div className="flex min-w-0 flex-1 flex-col gap-3 ">
        <div className="flex items-center justify-between border-b border-line pb-1 p-2.5">
          <span className="text-xs font-medium text-foreground">Assets</span>
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <button
              title="Not available yet"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-surface-2"
            >
              <ArrowDownUp size={12} />
            </button>
            <button
              onClick={() => void handleImport()}
              disabled={isImporting}
              title="Import a video file"
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {isImporting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Import
            </button>
          </div>
        </div>

        {recentProjects.length === 0 ? (
          <p className="px-2.5 text-xs text-muted-foreground">
            Your last {MAX_RECENT_PROJECTS} saved projects will show up here.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {recordedProjects.length > 0 && (
              <div className="flex flex-col gap-1 px-2.5">
                <span className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recorded
                </span>
                {recordedProjects.slice(0, MAX_RECENT_PROJECTS).map(renderProjectRow)}
              </div>
            )}
            {importedProjects.length > 0 && (
              <div className="flex flex-col gap-1 px-2.5">
                <span className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Imported
                </span>
                {importedProjects.slice(0, MAX_RECENT_PROJECTS).map(renderProjectRow)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

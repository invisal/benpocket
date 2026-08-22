import { useCallback, useState } from 'react';
import type { ProjectSummary } from '@screen-recorder/types/project';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { hasUnsavedChanges } from '../../history/store/history-store';
import { applyProjectSnapshot } from '../lib/apply-project-snapshot';

interface UseOpenProjectResult {
  loadingProjectId: string | null;
  error: string | null;
  openProject: (summary: ProjectSummary) => Promise<void>;
  /**
   * Set when `openProject` is blocked on confirming discarding unsaved
   * changes -- callers should render a confirmation dialog keyed off this
   * (non-null = open) and resolve it via `confirmDiscard`/`cancelDiscard`
   * rather than calling `openProject` again themselves.
   */
  pendingProject: ProjectSummary | null;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
}

/** Shared `project:open` -> `applyProjectSnapshot` flow used by both LibraryPage's "Saved projects" grid and the sidebar's recent-projects list. */
export function useOpenProject(): UseOpenProjectResult {
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProject, setPendingProject] = useState<ProjectSummary | null>(null);

  const loadProject = useCallback(async (summary: ProjectSummary): Promise<void> => {
    setLoadingProjectId(summary.id);
    setError(null);
    // Shared (not just this hook's own local state) so EditorPage can show
    // `EditorLoading` for the duration -- most visibly for the sidebar's
    // launch-time auto-resume, which used to switch to the editor route
    // only once loading had *already* finished, with nothing visible
    // happening anywhere beforehand.
    useScreenRecorderStore.getState().setIsOpeningProject(true);
    try {
      const project = await window.screenRecorder.project.open(summary.id);
      if (!project) {
        setError('Could not find that project on disk.');
        return;
      }
      await applyProjectSnapshot(project);
    } catch (err) {
      console.error('[project] failed to open project:', err);
      setError('Failed to load the project.');
    } finally {
      setLoadingProjectId(null);
      useScreenRecorderStore.getState().setIsOpeningProject(false);
    }
  }, []);

  // Stable identity (deps: []) so callers -- e.g. the sidebar's launch-time
  // auto-select effect -- can safely list it as an effect dependency
  // without that effect re-firing on every render.
  const openProject = useCallback(
    async (summary: ProjectSummary): Promise<void> => {
      // Already the open project -- e.g. clicked from the Library grid, or
      // its row in the sidebar again -- nothing to switch *to*, so just
      // make sure the editor is what's showing rather than re-fetching and
      // re-applying identical data from disk, which would silently discard
      // whatever's actually in progress if it happens to be dirty.
      if (summary.id === useScreenRecorderStore.getState().currentProjectId) {
        useScreenRecorderStore.getState().setRoute('editor');
        return;
      }
      // Nothing at risk of being lost yet (nothing's ever been edited since
      // the last open/save) -- also what keeps the sidebar's launch-time
      // auto-resume from ever hitting this, since it always fires before
      // anything could possibly be dirty.
      if (hasUnsavedChanges()) {
        setPendingProject(summary);
        return;
      }
      await loadProject(summary);
    },
    [loadProject]
  );

  const confirmDiscard = useCallback((): void => {
    const summary = pendingProject;
    setPendingProject(null);
    if (summary) void loadProject(summary);
  }, [pendingProject, loadProject]);

  const cancelDiscard = useCallback((): void => {
    setPendingProject(null);
  }, []);

  return {
    loadingProjectId,
    error,
    openProject,
    pendingProject,
    confirmDiscard,
    cancelDiscard
  };
}

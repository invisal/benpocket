import { useCallback, useState } from 'react';
import type { ProjectSummary } from '@screen-recorder/types/project';
import { useAppStore } from '../../../app/app-store';
import { applyProjectSnapshot } from '../lib/apply-project-snapshot';

interface UseOpenProjectResult {
  loadingProjectId: string | null;
  error: string | null;
  openProject: (summary: ProjectSummary) => Promise<void>;
}

/** Shared `project:open` -> `applyProjectSnapshot` flow used by both LibraryPage's "Saved projects" grid and the sidebar's recent-projects list. */
export function useOpenProject(): UseOpenProjectResult {
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stable identity (deps: []) so callers -- e.g. the sidebar's launch-time
  // auto-select effect -- can safely list it as an effect dependency
  // without that effect re-firing on every render.
  const openProject = useCallback(async (summary: ProjectSummary): Promise<void> => {
    setLoadingProjectId(summary.id);
    setError(null);
    // Shared (not just this hook's own local state) so EditorPage can show
    // `EditorLoading` for the duration -- most visibly for the sidebar's
    // launch-time auto-resume, which used to switch to the editor route
    // only once loading had *already* finished, with nothing visible
    // happening anywhere beforehand.
    useAppStore.getState().setIsOpeningProject(true);
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
      useAppStore.getState().setIsOpeningProject(false);
    }
  }, []);

  return { loadingProjectId, error, openProject };
}

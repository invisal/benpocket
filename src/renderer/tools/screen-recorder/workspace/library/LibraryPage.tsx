import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type { ProjectSummary } from '@screen-recorder/types/project';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { useAppStore } from '../../app/app-store';
import { useOpenProject } from '../../features/project/hooks/useOpenProject';
import { ProjectVideoThumbnail } from '../../features/project/components/ProjectVideoThumbnail';
import { formatTimeAgo } from '../../lib/format';

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function LibraryPage(): JSX.Element {
  const projectsVersion = useAppStore((state) => state.projectsVersion);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const { loadingProjectId, error: loadError, openProject } = useOpenProject();

  useEffect(() => {
    let cancelled = false;
    void window.screenRecorder.project.list().then((list) => {
      if (!cancelled) setProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, [projectsVersion]);

  async function handleDeleteProject(summary: ProjectSummary): Promise<void> {
    if (!window.confirm(`Delete "${summary.name}"? This can't be undone.`)) return;
    const ok = await window.screenRecorder.project.remove(summary.id);
    if (ok) setProjects((prev) => prev.filter((p) => p.id !== summary.id));
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Library</h1>

      {loadError && <p className="text-xs text-danger">{loadError}</p>}

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved projects yet. Record something and save it to see it here.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {projects.map((project) => (
            <ContextMenu.Root key={project.id}>
              <ContextMenu.Trigger
                render={
                  <button
                    onClick={() => void openProject(project)}
                    disabled={loadingProjectId !== null}
                    className="w-64 rounded-xl border border-line bg-surface p-2 text-left transition-colors hover:bg-surface-2 hover:border-accent/60 disabled:opacity-50"
                  >
                    <ProjectVideoThumbnail sourceVideoPath={project.sourceVideoPath} />
                    <p className="mt-2 truncate text-sm">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(project.durationMs)} · {formatTimeAgo(project.updatedAt)}
                    </p>
                    {loadingProjectId === project.id && (
                      <p className="mt-1 text-xs text-accent">Loading…</p>
                    )}
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
          ))}
        </div>
      )}
    </div>
  );
}

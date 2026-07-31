import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { Project, ProjectSummary } from '@screen-recorder/types/project';

/** Same `~/Movies/ScreenRecorder` parent directory recording-handlers.ts writes recording files into, with saved project JSON alongside in its own subfolder. */
function projectsDir(): string {
  return join(app.getPath('videos'), 'ScreenRecorder', 'projects');
}

export function registerProjectHandlers(): void {
  ipcMain.handle(
    IpcChannels.OpenProject,
    async (_event, projectId: string): Promise<Project | null> => {
      try {
        const raw = await fs.readFile(join(projectsDir(), `${projectId}.json`), 'utf-8');
        return JSON.parse(raw) as Project;
      } catch {
        return null;
      }
    }
  );

  ipcMain.handle(IpcChannels.SaveProject, async (_event, project: Project): Promise<boolean> => {
    try {
      await fs.mkdir(projectsDir(), { recursive: true });
      const filePath = join(projectsDir(), `${project.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[project] failed to save project:', err);
      return false;
    }
  });

  ipcMain.handle(IpcChannels.ListProjects, async (): Promise<ProjectSummary[]> => {
    let fileNames: string[];
    try {
      fileNames = await fs.readdir(projectsDir());
    } catch {
      return [];
    }

    const summaries = await Promise.all(
      fileNames
        .filter((name) => name.endsWith('.json'))
        .map(async (name): Promise<ProjectSummary | null> => {
          try {
            const raw = await fs.readFile(join(projectsDir(), name), 'utf-8');
            const project = JSON.parse(raw) as Project;
            return {
              id: project.id,
              name: project.name,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              durationMs: project.durationMs,
              sourceVideoPath: project.sourceVideoPath
            };
          } catch {
            return null;
          }
        })
    );

    return summaries
      .filter((s): s is ProjectSummary => s !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });

  ipcMain.handle(IpcChannels.DeleteProject, async (_event, projectId: string): Promise<boolean> => {
    try {
      await fs.unlink(join(projectsDir(), `${projectId}.json`));
      return true;
    } catch (err) {
      console.error('[project] failed to delete project:', err);
      return false;
    }
  });
}

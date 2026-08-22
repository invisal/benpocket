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
              sourceVideoPath: project.sourceVideoPath,
              // Legacy project JSONs predate this field -- default to
              // 'imported' (not 'recorded') since we can't tell which flow
              // actually produced them, and DeleteProject only cascades to
              // the video files for 'recorded' projects. Defaulting the
              // other way risks deleting a file the app never owned.
              source: project.source ?? 'imported'
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
    const filePath = join(projectsDir(), `${projectId}.json`);
    try {
      // Read the project before unlinking its JSON -- only a 'recorded'
      // project's video files are owned by the app (written into
      // ~/Movies/ScreenRecorder by the recorder itself); an 'imported'
      // project merely references a file the user picked from elsewhere on
      // disk, which must never be deleted here.
      let project: Project | null = null;
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        project = JSON.parse(raw) as Project;
      } catch {
        project = null;
      }

      await fs.unlink(filePath);

      if (project?.source === 'recorded') {
        // `exportSourceVideoPath`/`webcamExportSourceVideoPath` are a
        // separate on-disk file only when recording needed duration
        // patching (see Project's own doc) -- a Set dedupes the common case
        // where they're the same path as `sourceVideoPath`/`webcamVideoPath`,
        // so that file isn't attempted twice.
        const clipPaths = [
          ...new Set(
            [
              project.sourceVideoPath,
              project.exportSourceVideoPath,
              project.webcamVideoPath,
              project.webcamExportSourceVideoPath
            ].filter((path): path is string => !!path)
          )
        ];
        await Promise.all(
          clipPaths.map(async (clipPath) => {
            try {
              await fs.unlink(clipPath);
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error('[project] failed to delete clip file:', clipPath, err);
              }
            }
          })
        );
      }

      return true;
    } catch (err) {
      console.error('[project] failed to delete project:', err);
      return false;
    }
  });
}

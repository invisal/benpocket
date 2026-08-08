import type { ProjectSummary } from '@screen-recorder/types/project';

export function groupProjectsBySource(projects: ProjectSummary[]): {
  recorded: ProjectSummary[];
  imported: ProjectSummary[];
} {
  return {
    recorded: projects.filter((p) => p.source === 'recorded'),
    imported: projects.filter((p) => p.source === 'imported')
  };
}

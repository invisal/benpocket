import Store from 'electron-store';

interface RecentProjectsSchema {
  recentProjectPaths: string[];
}

export const recentProjectsStore = new Store<RecentProjectsSchema>({
  defaults: { recentProjectPaths: [] }
});

export function addRecentProject(path: string): void {
  const existing = recentProjectsStore.get('recentProjectPaths');
  const next = [path, ...existing.filter((p) => p !== path)].slice(0, 10);
  recentProjectsStore.set('recentProjectPaths', next);
}

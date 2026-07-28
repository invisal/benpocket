import type { BrowserWindow } from 'electron';

export interface WatchOptions {
  kubeconfigPath?: string;
  contextName?: string;
  resource: string;
  namespace?: string;
}

export class KubeWatchManager {
  private static activeWatches = new Map<string, boolean>();

  public static startWatch(id: string, options: WatchOptions, window?: BrowserWindow | null): void {
    void options;
    void window;
    this.activeWatches.set(id, true);
  }

  public static stopWatch(id: string): void {
    this.activeWatches.delete(id);
  }

  public static stopAllWatches(): void {
    this.activeWatches.clear();
  }
}

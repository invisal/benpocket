import type { BrowserWindow } from 'electron';

export interface WatchOptions {
  kubeconfigPath?: string;
  contextName?: string;
  resource: string;
  namespace?: string;
}

export interface WatchEvent {
  id: string;
  resource: string;
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object?: unknown;
}

export class KubeWatchManager {
  private static activeWatches = new Map<string, WatchOptions>();

  public static startWatch(id: string, options: WatchOptions, window?: BrowserWindow | null): void {
    this.stopWatch(id);
    this.activeWatches.set(id, options);

    if (window && !window.isDestroyed()) {
      window.webContents.send('kuberneter:watch-event', {
        id,
        resource: options.resource,
        type: 'MODIFIED'
      } as WatchEvent);
    }
  }

  public static stopWatch(id: string): void {
    this.activeWatches.delete(id);
  }

  public static stopAllWatches(): void {
    this.activeWatches.clear();
  }

  public static emitEvent(window: BrowserWindow | null, event: WatchEvent): void {
    if (window && !window.isDestroyed()) {
      window.webContents.send('kuberneter:watch-event', event);
    }
  }
}
